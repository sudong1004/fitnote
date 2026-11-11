import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** 인증 링크를 쓸 수 있는 시간. 메일을 다음 날 여는 사람도 있어 재설정(30분)보다 길다. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * 가입 이메일 인증.
 *
 * 가입(또는 이어받기)하면 계정은 만들어지지만 `emailVerifiedAt` 이 비어 있고, 그동안은
 * 로그인되지 않는다. 메일의 링크를 열어 버튼을 누르면 채워진다. 인증 전 계정은 한 번도
 * 로그인한 적이 없으므로 남긴 기록도 없다.
 */

/**
 * 이 주소를 쓰려는 계정이 있을 때, 주소를 비울 수 있으면 비운다.
 *
 * - 인증을 마친 계정이 쓰고 있으면 "taken".
 * - 인증하지 않은 가입 계정이면 그 계정을 지운다. 주소를 잘못 적었거나 남이 먼저 적어 둔
 *   경우이고, 로그인한 적이 없어 기록도 없다.
 * - 인증하지 않은 이어받기(트레이너가 만든 계정)면 이메일과 비밀번호만 다시 비운다.
 *   트레이너가 쌓은 기록은 그대로 둔다.
 */
export async function releaseUnverifiedEmail(
  tx: Prisma.TransactionClient,
  email: string,
  keepUserId?: string,
): Promise<"free" | "taken"> {
  const holder = await tx.user.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      _count: { select: { authSessions: true } },
    },
  });

  if (!holder || holder.id === keepUserId) return "free";
  if (holder.emailVerifiedAt) return "taken";

  if (holder.status === "PENDING") {
    await tx.emailVerificationToken.deleteMany({ where: { userId: holder.id } });
    await tx.user.update({
      where: { id: holder.id },
      data: { email: null, passwordHash: null },
    });
    return "free";
  }

  // 로그인한 흔적이 있으면 지우지 않는다. 인증 전에는 로그인이 안 되므로 있을 수 없지만,
  // 기록이 있는 계정을 실수로 지우는 일은 어떤 경우에도 없어야 한다.
  if (holder.status !== "ACTIVE" || holder.lastLoginAt || holder._count.authSessions > 0) {
    return "taken";
  }

  await tx.user.delete({ where: { id: holder.id } });
  return "free";
}

/**
 * 새 계정을 만든다(인증 전).
 *
 * 이미 인증된 계정이 그 주소를 쓰고 있으면 만들지 않고 "taken" 을 돌려준다. 부르는 쪽은
 * 어느 경우든 같은 화면을 보여 줘서, 가입된 주소인지 화면으로는 드러나지 않게 한다.
 */
export async function registerAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
  isTrainer: boolean;
  termsVersion: string;
}): Promise<{ status: "created"; userId: string } | { status: "taken" }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if ((await releaseUnverifiedEmail(tx, input.email)) === "taken") {
        return { status: "taken" as const };
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          termsVersion: input.termsVersion,
          termsAgreedAt: new Date(),
          ...(input.isTrainer
            ? { trainerProfile: { create: {} } }
            : { memberProfile: { create: {} } }),
        },
        select: { id: true },
      });

      return { status: "created" as const, userId: user.id };
    });
  } catch (error) {
    // 확인과 생성 사이에 같은 주소로 가입이 끝난 경우(버튼을 두 번 누른 경우 포함).
    if ((error as { code?: string })?.code === "P2002") return { status: "taken" };
    throw error;
  }
}

/**
 * 인증 링크용 토큰을 만든다.
 *
 * 이미 인증했거나 인증할 수 없는 계정(이메일 없음, 정지·탈퇴)이면 null.
 * 예전에 보낸 링크는 새 링크를 만들 때 모두 막는다.
 */
export async function createEmailVerificationToken(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true },
  });

  if (!user?.email || user.emailVerifiedAt) return null;
  if (user.status !== "ACTIVE" && user.status !== "PENDING") return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      },
    }),
  ]);

  return { token, name: user.name, email: user.email };
}

/** 다시 보내기용. 그 주소로 인증을 기다리는 계정이 있을 때만 토큰을 만든다. */
export async function createEmailVerificationTokenByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });

  return user ? createEmailVerificationToken(user.id) : null;
}

/**
 * 링크의 상태. 화면에서 무엇을 보여 줄지 정하는 데만 쓴다.
 *
 * - usable: 버튼을 누르면 인증된다
 * - done: 이 링크로 이미 인증을 마쳤다(두 번 연 경우)
 * - invalid: 만료됐거나, 새 링크가 나갔거나, 없는 링크
 */
export async function getVerificationTokenState(token: string): Promise<"usable" | "done" | "invalid"> {
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { email: true, emailVerifiedAt: true } },
    },
  });

  if (!row || row.user.email !== row.email) return "invalid";
  if (row.user.emailVerifiedAt) return "done";
  if (row.usedAt || row.expiresAt <= new Date()) return "invalid";
  return "usable";
}

/**
 * 인증을 끝낸다.
 *
 * 이어받기로 들어온 계정(PENDING)은 여기서 비로소 ACTIVE 가 되고 이어받기 코드가 닫힌다.
 * 그 전까지는 같은 코드로 이메일을 다시 적을 수 있어서, 주소를 잘못 적어도 막히지 않는다.
 */
export async function verifyEmailWithToken(token: string): Promise<"ok" | "invalid"> {
  const now = new Date();
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      email: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { email: true, status: true, emailVerifiedAt: true } },
    },
  });

  // 링크를 보낸 뒤 계정의 주소가 바뀌었으면(이어받기를 다른 주소로 다시 한 경우) 쓸 수 없다.
  if (!row || row.user.email !== row.email) return "invalid";
  if (row.user.emailVerifiedAt) return "ok";
  if (row.usedAt || row.expiresAt <= now) return "invalid";
  if (row.user.status !== "ACTIVE" && row.user.status !== "PENDING") return "invalid";

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return "invalid" as const;

    // 주소가 그대로일 때만 인증한다. 확인과 갱신 사이에 주소가 바뀐 경우를 막는다.
    const verified = await tx.user.updateMany({
      where: { id: row.userId, email: row.email, status: { in: ["ACTIVE", "PENDING"] } },
      data: { emailVerifiedAt: now, status: "ACTIVE" },
    });
    if (verified.count === 0) throw new StaleVerification();

    await tx.memberClaimCode.updateMany({
      where: { memberUserId: row.userId, claimedAt: null, revokedAt: null },
      data: { claimedAt: now },
    });
    await tx.emailVerificationToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    });

    return "ok" as const;
  }).catch((error) => {
    if (error instanceof StaleVerification) return "invalid" as const;
    throw error;
  });
}

class StaleVerification extends Error {}

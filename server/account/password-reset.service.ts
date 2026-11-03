import "server-only";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const SALT_ROUNDS = 10;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * 재설정 링크용 토큰을 만든다.
 *
 * 가입되지 않았거나, 비밀번호가 없는(트레이너가 대신 만든) 계정이거나, 탈퇴·정지된 계정이면
 * null 을 돌려준다. 부르는 쪽은 결과와 상관없이 같은 안내를 보여 줘야 한다.
 * 예전에 보낸 링크는 새 링크를 만들 때 모두 막는다.
 */
export async function createPasswordResetToken(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, status: true, passwordHash: true },
  });

  if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
    }),
  ]);

  return { token, name: user.name };
}

/** 링크가 아직 쓸 수 있는지. 화면에서 미리 알려 주는 데만 쓴다. */
export async function isResetTokenUsable(token: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return Boolean(row && !row.usedAt && row.expiresAt > new Date());
}

/**
 * 새 비밀번호로 바꾼다.
 *
 * 토큰은 한 번만 쓸 수 있고, 바꾸면 모든 기기의 로그인을 끊는다. 비밀번호를 잊은 사람이
 * 아니라 계정을 뺏긴 사람이 쓰는 경우도 있어서다.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<"ok" | "invalid"> {
  const now = new Date();
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { status: true } } },
  });

  if (!row || row.usedAt || row.expiresAt <= now || row.user.status !== "ACTIVE") return "invalid";

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // 같은 링크를 두 번 눌러도 한 번만 바뀌게 usedAt 이 비어 있을 때만 쓴다.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return "invalid";

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
    prisma.authSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } }),
  ]);

  return "ok";
}

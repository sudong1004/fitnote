import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  createEmailVerificationToken,
  createEmailVerificationTokenByEmail,
  getVerificationTokenState,
  registerAccount,
  verifyEmailWithToken,
} from "@/server/account/email-verification.service";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/server/account/password-reset.service";

import { uniq } from "./helpers";

const input = (overrides: Partial<Parameters<typeof registerAccount>[0]> = {}) => ({
  name: "가입회원",
  email: `verify-${uniq()}@test.com`,
  passwordHash: "hash",
  isTrainer: false,
  termsVersion: "test",
  ...overrides,
});

async function register(overrides: Partial<Parameters<typeof registerAccount>[0]> = {}) {
  const data = input(overrides);
  const result = await registerAccount(data);
  if (result.status !== "created") throw new Error("가입되지 않았다");
  return { ...data, userId: result.userId };
}

describe("가입 이메일 인증", () => {
  it("가입하면 인증 전 계정이 만들어지고, 링크로 인증하면 인증 시각이 남는다", async () => {
    const account = await register();

    const before = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(before.emailVerifiedAt).toBeNull();
    expect(before.status).toBe("ACTIVE");

    const issued = await createEmailVerificationToken(account.userId);
    expect(issued).toMatchObject({ email: account.email, name: "가입회원" });

    // DB 에는 원문이 아니라 해시만 남는다.
    const stored = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: account.userId } });
    expect(stored.tokenHash).not.toBe(issued!.token);

    expect(await getVerificationTokenState(issued!.token)).toBe("usable");
    expect(await verifyEmailWithToken(issued!.token)).toBe("ok");

    const after = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(after.emailVerifiedAt).not.toBeNull();

    // 같은 링크를 다시 열면 끝났다고 알려 주고, 다시 눌러도 문제없다.
    expect(await getVerificationTokenState(issued!.token)).toBe("done");
    expect(await verifyEmailWithToken(issued!.token)).toBe("ok");

    // 인증을 마친 계정에는 링크를 더 만들지 않는다.
    expect(await createEmailVerificationToken(account.userId)).toBeNull();
    expect(await createEmailVerificationTokenByEmail(account.email)).toBeNull();
  });

  it("새 링크를 받으면 예전 링크는 못 쓰고, 만료된 링크와 없는 링크도 못 쓴다", async () => {
    const account = await register();
    const first = await createEmailVerificationToken(account.userId);
    const second = await createEmailVerificationTokenByEmail(account.email.toUpperCase());

    expect(await getVerificationTokenState(first!.token)).toBe("invalid");
    expect(await verifyEmailWithToken(first!.token)).toBe("invalid");
    expect(await getVerificationTokenState(second!.token)).toBe("usable");

    await prisma.emailVerificationToken.updateMany({
      where: { userId: account.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getVerificationTokenState(second!.token)).toBe("invalid");
    expect(await verifyEmailWithToken(second!.token)).toBe("invalid");
    expect(await verifyEmailWithToken("no-such-token-no-such-token")).toBe("invalid");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("같은 링크를 동시에 눌러도 오류 없이 한 번만 인증된다", async () => {
    const account = await register();
    const issued = await createEmailVerificationToken(account.userId);

    const results = await Promise.all([
      verifyEmailWithToken(issued!.token),
      verifyEmailWithToken(issued!.token),
    ]);

    expect(results).toContain("ok");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("인증된 계정이 쓰는 주소로는 가입되지 않고, 원래 계정은 그대로다", async () => {
    const account = await register();
    const issued = await createEmailVerificationToken(account.userId);
    await verifyEmailWithToken(issued!.token);

    expect(await registerAccount(input({ email: account.email, passwordHash: "other" }))).toEqual({
      status: "taken",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user.passwordHash).toBe("hash");
  });

  it("인증하지 않은 주소로 다시 가입하면 새 가입이 그 주소를 가져가고 예전 링크는 못 쓴다", async () => {
    const first = await register();
    const stale = await createEmailVerificationToken(first.userId);

    const second = await register({
      email: first.email,
      name: "진짜주인",
      passwordHash: "hash-2",
      isTrainer: true,
    });

    expect(second.userId).not.toBe(first.userId);
    expect(await prisma.user.findUnique({ where: { id: first.userId } })).toBeNull();
    expect(await verifyEmailWithToken(stale!.token)).toBe("invalid");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: second.userId },
      select: { name: true, passwordHash: true, trainerProfile: { select: { id: true } }, memberProfile: true },
    });
    expect(user).toMatchObject({ name: "진짜주인", passwordHash: "hash-2", memberProfile: null });
    expect(user.trainerProfile).not.toBeNull();
  });

  it("로그인한 흔적이 있는 계정은 인증 시각이 비어 있어도 지우지 않는다", async () => {
    const account = await register();
    await prisma.authSession.create({
      data: { userId: account.userId, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    expect(await registerAccount(input({ email: account.email }))).toEqual({ status: "taken" });
    expect(await prisma.user.findUnique({ where: { id: account.userId } })).not.toBeNull();
  });

  it("같은 주소로 동시에 가입해도 계정은 하나만 생긴다", async () => {
    const email = `race-${uniq()}@test.com`;

    const results = await Promise.all([
      registerAccount(input({ email })),
      registerAccount(input({ email })),
    ]);

    expect(results.some((result) => result.status === "created")).toBe(true);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("정지·탈퇴한 계정에는 인증 링크를 만들지 않고, 이미 나간 링크도 못 쓴다", async () => {
    const account = await register();
    const issued = await createEmailVerificationToken(account.userId);

    await prisma.user.update({ where: { id: account.userId }, data: { status: "SUSPENDED" } });

    expect(await createEmailVerificationToken(account.userId)).toBeNull();
    expect(await verifyEmailWithToken(issued!.token)).toBe("invalid");
  });

  it("비밀번호 재설정 링크를 쓰면 이메일도 인증된 것으로 본다", async () => {
    const account = await register();

    const reset = await createPasswordResetToken(account.email);
    expect(await resetPasswordWithToken(reset!.token, "Newpass456")).toBe("ok");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });
});

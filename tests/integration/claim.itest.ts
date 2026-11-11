import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  createEmailVerificationToken,
  getVerificationTokenState,
  verifyEmailWithToken,
} from "@/server/account/email-verification.service";
import {
  claimMemberAccount,
  createMemberClaimCode,
  createTrainerInvitation,
  endConnection,
  redeemTrainerCode,
} from "@/server/trainers/connection.service";

import {
  makeClaimCode,
  makePendingMember,
  makeTrainer,
  uniq,
} from "./helpers";

const creds = () => ({
  email: `claim-${uniq()}@test.com`,
  passwordHash: "hash",
});

async function setup() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);
  const code = await makeClaimCode(trainer.userId, member.connectionId);

  return { trainer, member, code };
}

/** 이어받기를 끝까지: 이메일·비밀번호를 적고 인증 링크까지 누른 상태. */
async function claimAndVerify(code: string, credentials = creds()) {
  const claimed = await claimMemberAccount(code, credentials);
  if (claimed.status !== "claimed") throw new Error("이어받지 못했다");

  const issued = await createEmailVerificationToken(claimed.id);
  expect(await verifyEmailWithToken(issued!.token)).toBe("ok");

  return claimed;
}

describe("claimMemberAccount", () => {
  it("이어받으면 이메일과 비밀번호가 적히고, 인증을 끝내야 활성화되고 코드가 닫힌다", async () => {
    const { member, code } = await setup();
    const credentials = creds();

    const claimed = await claimMemberAccount(code, credentials);

    expect(claimed).toMatchObject({ status: "claimed", id: member.memberUserId });

    const select = { status: true, email: true, passwordHash: true, emailVerifiedAt: true };
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select,
    });

    // 인증 전: 아직 미가입 상태이고 코드도 열려 있다.
    expect(before).toEqual({
      status: "PENDING",
      email: credentials.email,
      passwordHash: "hash",
      emailVerifiedAt: null,
    });
    expect(
      (await prisma.memberClaimCode.findUniqueOrThrow({ where: { code } })).claimedAt,
    ).toBeNull();

    const issued = await createEmailVerificationToken(member.memberUserId);
    expect(await verifyEmailWithToken(issued!.token)).toBe("ok");

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select,
    });
    expect(after.status).toBe("ACTIVE");
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(
      (await prisma.memberClaimCode.findUniqueOrThrow({ where: { code } })).claimedAt,
    ).not.toBeNull();
  });

  it("인증을 끝낸 뒤에는 같은 코드로 다시 이어받을 수 없다", async () => {
    const { code } = await setup();

    await claimAndVerify(code);

    await expect(claimMemberAccount(code, creds())).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("인증 전에는 같은 코드로 주소를 다시 적을 수 있고, 예전 주소로 간 링크는 못 쓴다", async () => {
    const { member, code } = await setup();
    const typo = creds();
    const right = creds();

    await claimMemberAccount(code, typo);
    const stale = await createEmailVerificationToken(member.memberUserId);

    await claimMemberAccount(code, { ...right, passwordHash: "hash-2" });
    expect(await getVerificationTokenState(stale!.token)).toBe("invalid");
    expect(await verifyEmailWithToken(stale!.token)).toBe("invalid");

    const fresh = await createEmailVerificationToken(member.memberUserId);
    expect(fresh!.email).toBe(right.email);
    expect(await verifyEmailWithToken(fresh!.token)).toBe("ok");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select: { email: true, passwordHash: true, status: true },
    });
    expect(user).toEqual({ email: right.email, passwordHash: "hash-2", status: "ACTIVE" });
  });

  it("동시에 두 사람이 눌러도 이메일과 비밀번호는 같은 사람 것끼리 짝이 맞는다", async () => {
    const { member, code } = await setup();
    const a = { email: `a-${uniq()}@test.com`, passwordHash: "hash-a" };
    const b = { email: `b-${uniq()}@test.com`, passwordHash: "hash-b" };

    await Promise.all([claimMemberAccount(code, a), claimMemberAccount(code, b)]);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select: { email: true, passwordHash: true },
    });

    expect([a.email, b.email]).toContain(user.email);
    expect(user.passwordHash).toBe(user.email === a.email ? "hash-a" : "hash-b");
  });

  it("회수했거나 만료된 코드는 거절한다", async () => {
    const revoked = await setup();
    await prisma.memberClaimCode.update({
      where: { code: revoked.code },
      data: { revokedAt: new Date() },
    });
    await expect(
      claimMemberAccount(revoked.code, creds()),
    ).rejects.toMatchObject({ code: "INVALID_CODE" });

    const expired = await setup();
    await prisma.memberClaimCode.update({
      where: { code: expired.code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      claimMemberAccount(expired.code, creds()),
    ).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("인증된 계정이 쓰는 이메일이면 아무것도 바꾸지 않고 taken 을 돌려준다", async () => {
    const { member, code } = await setup();
    const taken = await prisma.user.create({
      data: {
        name: "기존",
        email: `taken-${uniq()}@test.com`,
        passwordHash: "x",
        emailVerifiedAt: new Date(),
      },
      select: { email: true },
    });

    expect(
      await claimMemberAccount(code, { email: taken.email!, passwordHash: "h" }),
    ).toEqual({ status: "taken" });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select: { email: true, passwordHash: true, status: true },
    });
    expect(user).toEqual({ email: null, passwordHash: null, status: "PENDING" });
  });

  it("새 코드를 발급하면 이전 코드는 못 쓴다", async () => {
    const { trainer, member, code: oldCode } = await setup();

    await createMemberClaimCode(trainer.userId, member.connectionId);

    await expect(claimMemberAccount(oldCode, creds())).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("이미 가입한 회원에게는 코드를 발급하지 않는다", async () => {
    const { trainer, member, code } = await setup();

    await claimAndVerify(code);

    await expect(
      createMemberClaimCode(trainer.userId, member.connectionId),
    ).rejects.toMatchObject({ code: "ALREADY_CONNECTED" });
  });
});

describe("한 회원은 한 번에 한 트레이너", () => {
  async function makeMember() {
    return prisma.user.create({
      data: {
        name: `일반회원${uniq()}`,
        email: `solo-${uniq()}@test.com`,
        passwordHash: "x",
      },
      select: { id: true },
    });
  }

  it("담당 트레이너가 있으면 다른 트레이너 코드는 거절하고, 끊은 뒤에는 연결된다", async () => {
    const first = await makeTrainer();
    const second = await makeTrainer();
    const member = await makeMember();

    const a = await createTrainerInvitation(first.userId);
    const b = await createTrainerInvitation(second.userId);

    const joined = await redeemTrainerCode(member.id, a.code);

    await expect(redeemTrainerCode(member.id, b.code)).rejects.toMatchObject({
      code: "HAS_TRAINER",
    });
    // 거절된 코드는 쓴 횟수에 잡히지 않는다.
    const unused = await prisma.trainerInvitation.findUniqueOrThrow({
      where: { id: b.id },
      select: { usedCount: true },
    });
    expect(unused.usedCount).toBe(0);

    await endConnection(member.id, joined.connectionId);
    await expect(redeemTrainerCode(member.id, b.code)).resolves.toBeTruthy();
  });

  it("같은 트레이너 코드를 다시 넣으면 기존처럼 이미 연결됐다고 답한다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const inv = await createTrainerInvitation(trainer.userId);

    await redeemTrainerCode(member.id, inv.code);
    await expect(redeemTrainerCode(member.id, inv.code)).rejects.toMatchObject({
      code: "ALREADY_CONNECTED",
    });
  });

  it("두 코드를 동시에 넣어도 한 쪽만 연결된다", async () => {
    const first = await makeTrainer();
    const second = await makeTrainer();
    const member = await makeMember();
    const a = await createTrainerInvitation(first.userId);
    const b = await createTrainerInvitation(second.userId);

    const results = await Promise.allSettled([
      redeemTrainerCode(member.id, a.code),
      redeemTrainerCode(member.id, b.code),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const active = await prisma.trainerMemberConnection.count({
      where: { memberUserId: member.id, status: "ACTIVE" },
    });
    expect(active).toBe(1);
  });
});

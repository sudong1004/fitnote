import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  ConnectionError,
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

describe("claimMemberAccount", () => {
  it("미가입 계정을 이어받으면 활성화되고 코드가 닫힌다", async () => {
    const { member, code } = await setup();
    const credentials = creds();

    const user = await claimMemberAccount(code, credentials);

    expect(user.id).toBe(member.memberUserId);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { status: true, email: true, passwordHash: true },
    });

    expect(row).toEqual({
      status: "ACTIVE",
      email: credentials.email,
      passwordHash: "hash",
    });

    const claim = await prisma.memberClaimCode.findUniqueOrThrow({
      where: { code },
      select: { claimedAt: true },
    });

    expect(claim.claimedAt).not.toBeNull();
  });

  it("같은 코드로 두 번째는 거절한다", async () => {
    const { code } = await setup();

    await claimMemberAccount(code, creds());

    await expect(claimMemberAccount(code, creds())).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("동시에 두 사람이 눌러도 한쪽만 계정을 가져가고 비밀번호가 덮이지 않는다", async () => {
    const { member, code } = await setup();
    const a = { email: `a-${uniq()}@test.com`, passwordHash: "hash-a" };
    const b = { email: `b-${uniq()}@test.com`, passwordHash: "hash-b" };

    const results = await Promise.allSettled([
      claimMemberAccount(code, a),
      claimMemberAccount(code, b),
    ]);

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConnectionError,
    );

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: member.memberUserId },
      select: { email: true, passwordHash: true },
    });

    const winner = won[0].status === "fulfilled" && won[0].value.id;
    expect(winner).toBe(member.memberUserId);
    expect([a.email, b.email]).toContain(user.email);
    // 이메일과 비밀번호가 같은 사람 것이어야 한다.
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

  it("이미 쓰는 이메일이면 코드를 쓰지 않고 거절한다", async () => {
    const { code } = await setup();
    const taken = await prisma.user.create({
      data: { name: "기존", email: `taken-${uniq()}@test.com`, passwordHash: "x" },
      select: { email: true },
    });

    await expect(
      claimMemberAccount(code, { email: taken.email!, passwordHash: "h" }),
    ).rejects.toMatchObject({ code: "ALREADY_CONNECTED" });

    // 실패했으니 코드는 아직 살아 있어야 한다.
    const claim = await prisma.memberClaimCode.findUniqueOrThrow({
      where: { code },
      select: { claimedAt: true },
    });
    expect(claim.claimedAt).toBeNull();
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

    await claimMemberAccount(code, creds());

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

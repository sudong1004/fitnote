import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteMyAccount } from "@/server/account/delete-account.service";
import {
  createPasswordResetToken,
  isResetTokenUsable,
  resetPasswordWithToken,
} from "@/server/account/password-reset.service";
import { createContract } from "@/server/pt/pt.service";

import { makeContract, makeTrainer, uniq } from "./helpers";

async function makeMember(password = "oldpass123") {
  const email = `launch-${uniq()}@test.com`;
  const user = await prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email,
      phone: "010-0000-0000",
      passwordHash: await bcrypt.hash(password, 4),
      memberProfile: { create: { gender: "F" } },
    },
    select: { id: true },
  });
  return { ...user, email };
}

describe("비밀번호 재설정", () => {
  it("링크는 한 번만 쓰이고, 쓰면 비밀번호가 바뀌고 다른 로그인이 끊긴다", async () => {
    const member = await makeMember();
    await prisma.authSession.create({ data: { userId: member.id, expiresAt: new Date(Date.now() + 86_400_000) } });

    const issued = await createPasswordResetToken(member.email.toUpperCase());
    expect(issued).not.toBeNull();
    const token = issued!.token;
    expect(await isResetTokenUsable(token)).toBe(true);

    // DB 에는 원문이 아니라 해시만 남는다.
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: member.id } });
    expect(stored.tokenHash).not.toBe(token);

    expect(await resetPasswordWithToken(token, "Newpass456")).toBe("ok");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await bcrypt.compare("Newpass456", user.passwordHash!)).toBe(true);
    expect(await prisma.authSession.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);

    expect(await isResetTokenUsable(token)).toBe(false);
    expect(await resetPasswordWithToken(token, "Another789")).toBe("invalid");
  });

  it("새 링크를 받으면 예전 링크는 못 쓰고, 만료된 링크도 못 쓴다", async () => {
    const member = await makeMember();
    const first = await createPasswordResetToken(member.email);
    const second = await createPasswordResetToken(member.email);
    expect(await isResetTokenUsable(first!.token)).toBe(false);
    expect(await isResetTokenUsable(second!.token)).toBe(true);

    await prisma.passwordResetToken.updateMany({
      where: { userId: member.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resetPasswordWithToken(second!.token, "Newpass456")).toBe("invalid");
  });

  it("없는 이메일이나 탈퇴한 계정에는 링크를 만들지 않는다", async () => {
    expect(await createPasswordResetToken(`nobody-${uniq()}@test.com`)).toBeNull();
    const member = await makeMember();
    await prisma.user.update({ where: { id: member.id }, data: { status: "DELETED" } });
    expect(await createPasswordResetToken(member.email)).toBeNull();
  });
});

describe("회원 탈퇴", () => {
  it("비밀번호가 틀리면 아무것도 지우지 않는다", async () => {
    const member = await makeMember();
    expect(await deleteMyAccount(member.id, "wrong")).toEqual({ ok: false, reason: "wrong-password" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("ACTIVE");
  });

  it("회원: 개인 기록은 지우고, 함께 만든 PT 기록은 이름 없이 남기고, 앞 수업은 차감 없이 취소한다", async () => {
    const { trainer, member, contractId } = await makeContract(10, createContract);
    const memberUserId = member.memberUserId;
    await prisma.user.update({
      where: { id: memberUserId },
      data: { email: `del-${uniq()}@test.com`, passwordHash: await bcrypt.hash("pw123456", 4), phone: "010-1" },
    });
    await prisma.bodyRecord.create({ data: { userId: memberUserId, recordedAt: new Date(), weightKg: 70 } });
    await prisma.authSession.create({ data: { userId: memberUserId, expiresAt: new Date(Date.now() + 86_400_000) } });
    const future = await prisma.pTSession.create({
      data: {
        contractId,
        memberUserId,
        trainerProfileId: trainer.profileId,
        sessionNumber: 1,
        scheduledAt: new Date(Date.now() + 3 * 86_400_000),
        durationMinutes: 50,
      },
    });

    expect(await deleteMyAccount(memberUserId, "pw123456")).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: memberUserId } });
    expect(user).toMatchObject({ status: "DELETED", name: "탈퇴한 회원", email: null, phone: null, passwordHash: null });
    expect(user.deletedAt).not.toBeNull();
    expect(await prisma.bodyRecord.count({ where: { userId: memberUserId } })).toBe(0);
    expect(await prisma.memberProfile.count({ where: { userId: memberUserId } })).toBe(0);
    expect(await prisma.authSession.count({ where: { userId: memberUserId } })).toBe(0);
    expect(await prisma.pTContract.count({ where: { id: contractId } })).toBe(1);
    expect(await prisma.pTSession.findUniqueOrThrow({ where: { id: future.id } })).toMatchObject({
      status: "CANCELLED",
      cancelledBy: "MEMBER",
      deducted: false,
    });
    expect(
      await prisma.trainerMemberConnection.count({ where: { memberUserId, status: "ACTIVE" } }),
    ).toBe(0);
  });

  it("트레이너: 남은 회차가 있는 계약이 있으면 막고, 없으면 소개를 지우고 연결을 끝낸다", async () => {
    const { trainer, contractId } = await makeContract(5, createContract);
    expect(await deleteMyAccount(trainer.userId, "x")).toMatchObject({ ok: false });
    // helpers 의 트레이너 비밀번호 해시는 "x" 라 bcrypt 비교가 실패한다. 실제 해시로 바꾼다.
    await prisma.user.update({ where: { id: trainer.userId }, data: { passwordHash: await bcrypt.hash("pw123456", 4) } });
    expect(await deleteMyAccount(trainer.userId, "pw123456")).toEqual({ ok: false, reason: "active-contracts", count: 1 });

    await prisma.pTContract.update({ where: { id: contractId }, data: { status: "COMPLETED" } });
    await prisma.trainerProfile.update({ where: { id: trainer.profileId }, data: { bio: "소개" } });
    expect(await deleteMyAccount(trainer.userId, "pw123456")).toEqual({ ok: true });

    expect(await prisma.trainerProfile.findUniqueOrThrow({ where: { id: trainer.profileId } })).toMatchObject({
      bio: null,
      displayName: null,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } })).name).toBe("탈퇴한 트레이너");
    expect(
      await prisma.trainerMemberConnection.count({ where: { trainerProfileId: trainer.profileId, status: "ACTIVE" } }),
    ).toBe(0);
  });

  it("비밀번호 없이 만든 계정(트레이너가 만든 회원)은 비밀번호 없이 탈퇴된다", async () => {
    const trainer = await makeTrainer();
    void trainer;
    const user = await prisma.user.create({ data: { name: "무비번" }, select: { id: true } });
    expect(await deleteMyAccount(user.id, "")).toEqual({ ok: true });
  });
});

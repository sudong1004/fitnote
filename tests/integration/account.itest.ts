import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { ProfileFormSchema, TrainerIntroSchema } from "@/app/lib/definitions";
import { prisma } from "@/lib/prisma";
import {
  changePassword,
  getMyAccount,
  updateMyProfile,
  updateTrainerIntro,
} from "@/server/account/account.service";

import { makeTrainer, uniq } from "./helpers";

async function makeMember(password = "oldpass123") {
  return prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email: `acct-${uniq()}@test.com`,
      passwordHash: await bcrypt.hash(password, 4),
      memberProfile: { create: {} },
    },
    select: { id: true },
  });
}

async function session(userId: string) {
  return prisma.authSession.create({
    data: { userId, expiresAt: new Date(Date.now() + 86_400_000) },
    select: { id: true },
  });
}

describe("내 정보 수정", () => {
  it("이름과 전화번호를 바꾸고, 빈 전화번호는 지운다", async () => {
    const user = await makeMember();

    await updateMyProfile(user.id, { name: "새이름", phone: "010-1111-2222" });
    expect(await getMyAccount(user.id)).toMatchObject({ name: "새이름", phone: "010-1111-2222", hasPassword: true });

    const cleared = ProfileFormSchema.parse({ name: " 새이름 ", phone: "  " });
    expect(cleared).toEqual({ name: "새이름", phone: null });
    await updateMyProfile(user.id, cleared);
    expect((await getMyAccount(user.id)).phone).toBeNull();
  });

  it("이상한 전화번호와 짧은 이름은 거절한다", () => {
    expect(ProfileFormSchema.safeParse({ name: "김", phone: "" }).success).toBe(false);
    expect(ProfileFormSchema.safeParse({ name: "김회원", phone: "전화" }).success).toBe(false);
  });

  it("트레이너 소개를 바꾸고, 회원 계정에는 아무 일도 없다", async () => {
    const trainer = await makeTrainer();
    const intro = TrainerIntroSchema.parse({ displayName: "코치킴", specialty: "재활, 체형", careerYears: "7", bio: "" });

    await updateTrainerIntro(trainer.userId, intro);
    expect((await getMyAccount(trainer.userId)).trainerProfile).toEqual({
      displayName: "코치킴",
      specialty: "재활, 체형",
      careerYears: 7,
      bio: null,
    });

    const member = await makeMember();
    await updateTrainerIntro(member.id, intro);
    expect((await getMyAccount(member.id)).trainerProfile).toBeNull();
  });

  it("경력은 0~60 숫자만 받는다", () => {
    expect(TrainerIntroSchema.safeParse({ displayName: "", specialty: "", careerYears: "61", bio: "" }).success).toBe(false);
    expect(TrainerIntroSchema.safeParse({ displayName: "", specialty: "", careerYears: "3년", bio: "" }).success).toBe(false);
  });
});

describe("비밀번호 변경", () => {
  it("지금 비밀번호가 틀리면 바꾸지 않는다", async () => {
    const user = await makeMember("oldpass123");
    const current = await session(user.id);

    expect(await changePassword(user.id, current.id, { currentPassword: "wrong1234", newPassword: "newpass456" })).toBe("wrong-password");

    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("oldpass123", passwordHash!)).toBe(true);
  });

  it("바꾸면 새 비밀번호가 맞고, 지금 기기만 남기고 다른 기기 로그인은 끊는다", async () => {
    const user = await makeMember("oldpass123");
    const current = await session(user.id);
    const other = await session(user.id);

    expect(await changePassword(user.id, current.id, { currentPassword: "oldpass123", newPassword: "newpass456" })).toBe("ok");

    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("newpass456", passwordHash!)).toBe(true);

    const sessions = await prisma.authSession.findMany({ where: { userId: user.id }, select: { id: true, revokedAt: true } });
    expect(sessions.find((s) => s.id === current.id)?.revokedAt).toBeNull();
    expect(sessions.find((s) => s.id === other.id)?.revokedAt).not.toBeNull();
  });
});

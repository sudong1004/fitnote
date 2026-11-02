import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const SALT_ROUNDS = 10;

/** 내 정보(이름·전화번호)를 읽는다. 수정 화면의 기본값으로 쓴다. */
export async function getMyAccount(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      passwordHash: true,
      trainerProfile: {
        select: { displayName: true, specialty: true, careerYears: true, bio: true },
      },
    },
  }).then(({ passwordHash, ...rest }) => ({ ...rest, hasPassword: passwordHash !== null }));
}

export async function updateMyProfile(
  userId: string,
  input: { name: string; phone: string | null },
) {
  await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone },
  });
}

/** 트레이너 소개. 트레이너 프로필이 없는 계정이면 아무것도 하지 않는다. */
export async function updateTrainerIntro(
  userId: string,
  input: {
    displayName: string | null;
    specialty: string | null;
    careerYears: number | null;
    bio: string | null;
  },
) {
  await prisma.trainerProfile.updateMany({
    where: { userId },
    data: input,
  });
}

/**
 * 비밀번호 변경.
 *
 * 지금 비밀번호가 맞아야 바꾼다. 바꾼 뒤에는 지금 쓰는 기기만 남기고 다른
 * 기기의 로그인을 끊는다. 비밀번호를 바꾸는 흔한 이유가 "누가 내 계정을 쓰는 것
 * 같아서" 이기 때문이다.
 */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<"ok" | "wrong-password"> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    return "wrong-password";
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authSession.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    }),
  ]);

  return "ok";
}

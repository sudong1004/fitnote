import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { removeObjects } from "@/lib/storage";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "wrong-password" | "active-contracts"; count?: number };

/**
 * 트레이너가 탈퇴하면 안 되는 상태인지. 진행 중이고 남은 회차가 있는 계약이
 * 있으면 회원이 받기로 한 수업이 갈 곳을 잃는다. 계약을 먼저 마무리하게 한다.
 */
export async function countBlockingContracts(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return 0;
  const contracts = await prisma.pTContract.findMany({
    where: {
      trainerProfileId: profile.id,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { totalSessions: true, usedSessions: true },
  });
  return contracts.filter((c) => c.usedSessions < c.totalSessions).length;
}

/**
 * 회원 탈퇴.
 *
 * 사용자 행은 지우지 않고 익명으로 바꾼다. 트레이너와 함께 만든 기록(PT 계약,
 * 회차, 알림장, 댓글)은 상대방의 업무 기록이기도 해서 남기되, 이름·이메일·전화번호
 * 같은 나를 알아볼 수 있는 정보는 모두 지운다. 혼자 남긴 기록(식단과 사진, 체성분,
 * 목표, 개인 운동, 즐겨찾기, 알림)은 지운다.
 */
export async function deleteMyAccount(userId: string, password: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true, trainerProfile: { select: { id: true } } },
  });

  if (user.passwordHash && !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, reason: "wrong-password" };
  }

  const blocking = await countBlockingContracts(userId);
  if (blocking > 0) return { ok: false, reason: "active-contracts", count: blocking };

  const trainerProfileId = user.trainerProfile?.id ?? null;
  const now = new Date();

  const photos = await prisma.$transaction(async (tx) => {
    const diets = await tx.dietRecord.findMany({
      where: { userId },
      select: { imagePath: true, thumbnailPath: true },
    });

    // 혼자 남긴 기록
    await tx.dietRecord.deleteMany({ where: { userId } });
    await tx.bodyRecord.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    await tx.workoutSession.deleteMany({ where: { userId, ptSessionId: null } });
    await tx.workoutFavorite.deleteMany({ where: { userId } });
    await tx.routine.deleteMany({ where: { userId } });
    await tx.aiAnalysis.deleteMany({ where: { userId } });
    await tx.trainerSharingSetting.deleteMany({ where: { userId } });
    await tx.memberProfile.deleteMany({ where: { userId } });

    // 기기·알림·로그인
    await tx.deviceToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.centerMembership.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.authSession.deleteMany({ where: { userId } });

    // 회원으로서: 앞으로 잡힌 수업은 회원 사정으로 취소(차감 없음), 연결은 끝낸다.
    await tx.pTSession.updateMany({
      where: { memberUserId: userId, status: "SCHEDULED", scheduledAt: { gt: now } },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: "MEMBER",
        cancelReason: "회원 탈퇴",
        deducted: false,
      },
    });
    await tx.trainerMemberConnection.updateMany({
      where: { memberUserId: userId, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: now },
    });
    await tx.memberClaimCode.updateMany({
      where: { memberUserId: userId, claimedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });

    // 트레이너로서: 연결을 끝내고, 초대 코드를 막고, 회원에게 보이던 소개를 지운다.
    if (trainerProfileId) {
      await tx.trainerMemberConnection.updateMany({
        where: { trainerProfileId, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: now },
      });
      await tx.trainerInvitation.updateMany({
        where: { trainerProfileId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.memberClaimCode.updateMany({
        where: { trainerProfileId, claimedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.trainerProfile.update({
        where: { id: trainerProfileId },
        data: { displayName: null, bio: null, specialty: null, careerYears: null, profileImageUrl: null },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        name: trainerProfileId ? "탈퇴한 트레이너" : "탈퇴한 회원",
        email: null,
        phone: null,
        passwordHash: null,
        profileImageUrl: null,
        status: "DELETED",
        deletedAt: now,
      },
    });

    return diets.flatMap((d) => [d.imagePath, d.thumbnailPath]).filter((p): p is string => !!p);
  });

  // 사진은 DB 가 정리된 뒤에 지운다. 실패해도 계정 정리는 이미 끝났다.
  try {
    await removeObjects(photos);
  } catch (error) {
    console.error("[delete-account] 사진 삭제 실패", error);
  }

  return { ok: true };
}

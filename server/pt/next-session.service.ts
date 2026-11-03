import "server-only";

import { PTSessionStatus } from "@/generated/prisma/enums";
import { kstDaysAgo, kstWeekdayLabel, toKstDateKey, toKstTimeValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "@/server/trainers/trainer.service";

import { PTError, isExpired } from "./pt-shared";

export type NextSessionDay = {
  dateKey: string;
  weekday: string;
  day: number;
  month: number;
  /** 그날 이미 잡혀 있거나 끝낸 내 수업 수. 빈 날을 고르기 쉽게 보여 준다. */
  count: number;
};

/**
 * 수업을 마친 직후 "다음 수업도 잡을까요?" 에 필요한 것.
 *
 * 날짜는 미리 고르지 않는다. 일주일에 몇 번 받을지는 회원마다, 주마다 달라서
 * "다음 주 같은 날" 을 채워 두면 오히려 지우는 일이 생긴다. 대신 앞으로 2주의
 * 날짜와 그날 내 수업 수를 보여 주고, 시각과 수업 시간만 오늘 것으로 채운다.
 */
export async function getNextSessionPlan(userId: string, ptSessionId: string, days = 14) {
  const trainer = await requireTrainerProfile(userId);
  const session = await prisma.pTSession.findFirst({
    where: { id: ptSessionId, trainerProfileId: trainer.id },
    select: {
      contractId: true,
      scheduledAt: true,
      durationMinutes: true,
      contract: { select: { status: true, totalSessions: true, expiresAt: true } },
    },
  });

  if (!session) {
    throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
  }

  const now = new Date();
  const start = kstDaysAgo(-1, now); // 내일 0시(KST)
  const end = kstDaysAgo(-1 - days, now);

  const [taken, upcoming, mine] = await Promise.all([
    prisma.pTSession.count({
      where: {
        contractId: session.contractId,
        OR: [{ deducted: true }, { status: PTSessionStatus.SCHEDULED }],
      },
    }),
    prisma.pTSession.findFirst({
      where: {
        contractId: session.contractId,
        status: PTSessionStatus.SCHEDULED,
        scheduledAt: { gt: now },
      },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    }),
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: { in: [PTSessionStatus.SCHEDULED, PTSessionStatus.COMPLETED] },
        scheduledAt: { gte: start, lt: end },
      },
      select: { scheduledAt: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const { scheduledAt } of mine) {
    const key = toKstDateKey(scheduledAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const list: NextSessionDay[] = Array.from({ length: days }, (_, index) => {
    const date = kstDaysAgo(-1 - index, now);
    const dateKey = toKstDateKey(date);
    const [, month, day] = dateKey.split("-").map(Number);
    return { dateKey, weekday: kstWeekdayLabel(date), month, day, count: counts.get(dateKey) ?? 0 };
  });

  const contract = session.contract;

  return {
    contractId: session.contractId,
    canSchedule:
      contract.status === "ACTIVE" && !isExpired(contract) && taken < contract.totalSessions,
    remainingToSchedule: Math.max(contract.totalSessions - taken, 0),
    upcomingAt: upcoming?.scheduledAt ?? null,
    defaultTime: toKstTimeValue(session.scheduledAt),
    defaultDuration: session.durationMinutes,
    firstDateKey: list[0].dateKey,
    days: list,
  };
}

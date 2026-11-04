import "server-only";

import { ConnectionStatus, JournalStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { requireTrainerProfile } from "./trainer-shared";

export type TrainerStartProgress = {
  hasMember: boolean;
  hasContract: boolean;
  hasSession: boolean;
  hasJournal: boolean;
};

/**
 * 처음 쓰는 트레이너가 어디까지 왔는지.
 *
 * 홈의 "시작하기" 카드가 쓴다. 네 단계가 모두 끝나면 카드는 사라진다.
 * 개수가 아니라 있는지만 필요하므로 take: 1 로 끊는다.
 */
export async function getTrainerStartProgress(
  userId: string,
): Promise<TrainerStartProgress> {
  const trainer = await requireTrainerProfile(userId);
  const where = { trainerProfileId: trainer.id };

  const [member, contract, session, journal] = await Promise.all([
    prisma.trainerMemberConnection.findFirst({
      where: { ...where, status: ConnectionStatus.ACTIVE },
      select: { id: true },
    }),
    prisma.pTContract.findFirst({ where, select: { id: true } }),
    prisma.pTSession.findFirst({ where, select: { id: true } }),
    prisma.journal.findFirst({
      where: { ...where, status: JournalStatus.PUBLISHED },
      select: { id: true },
    }),
  ]);

  return {
    hasMember: member !== null,
    hasContract: contract !== null,
    hasSession: session !== null,
    hasJournal: journal !== null,
  };
}

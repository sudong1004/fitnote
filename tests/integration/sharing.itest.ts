import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createContract, scheduleSession } from "@/server/pt/pt.service";
import {
  getSessionHints,
  openSessionWorkout,
} from "@/server/pt/session-record.service";
import { getMemberStats } from "@/server/trainers/trainer.service";
import {
  addRecord,
  addSet,
  copyPreviousSets,
  startSession,
} from "@/server/workouts/workout.service";

import { makePendingMember, makeTrainer, uniq } from "./helpers";

/**
 * 회원이 혼자 한 운동은 공유를 켜기 전에는 트레이너에게 새면 안 된다.
 *
 * ptOnly 는 서버 액션 인자라 클라이언트가 마음대로 보낼 수 있다. 막는 일은 화면이 넘겨 준
 * 값이 아니라 서비스가 회원의 공유 설정을 직접 보고 해야 한다.
 */
async function setup() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);

  const exercise = await prisma.exercise.create({
    data: {
      name: `데드리프트-${uniq()}`,
      bodyPart: "BACK",
      movementType: "HINGE",
      difficulty: "BEGINNER",
    },
    select: { id: true },
  });

  // 회원이 혼자 한 운동: 100kg × 5회
  const personal = await startSession(member.memberUserId, { mode: "new" });
  const personalRecord = await addRecord(
    member.memberUserId,
    personal.session!.id,
    { exerciseId: exercise.id },
  );
  await addSet(member.memberUserId, personalRecord!.record.id, {
    weight: 100,
    reps: 5,
    completed: true,
  });

  // 트레이너가 연 PT 수업의 빈 기록
  const contract = await createContract(trainer.userId, {
    connectionId: member.connectionId,
    totalSessions: 5,
    startedAt: new Date(),
  });
  const pt = await scheduleSession(trainer.userId, {
    contractId: contract.id,
    scheduledAt: new Date(Date.now() - 3_600_000),
  });
  const workoutId = await openSessionWorkout(trainer.userId, pt.id);
  const ptRecord = await addRecord(trainer.userId, workoutId, {
    exerciseId: exercise.id,
  });

  return {
    trainer,
    member,
    recordId: ptRecord!.record.id,
    ptSessionId: pt.id,
    exerciseId: exercise.id,
    personalSessionId: personal.session!.id,
  };
}

const sharePersonal = (userId: string) =>
  prisma.trainerSharingSetting.upsert({
    where: { userId },
    create: { userId, sharePersonalWorkout: true },
    update: { sharePersonalWorkout: true },
  });

/** 같은 회원이 예전에 다른 트레이너와 한 PT: 140kg × 3회. 그 관계는 끝났다. */
async function addPastTrainerRecord(memberUserId: string, exerciseId: string) {
  const past = await makeTrainer();

  const connection = await prisma.trainerMemberConnection.create({
    data: { trainerProfileId: past.profileId, memberUserId },
    select: { id: true },
  });
  const contract = await createContract(past.userId, {
    connectionId: connection.id,
    totalSessions: 5,
    startedAt: new Date(),
  });
  const pt = await scheduleSession(past.userId, {
    contractId: contract.id,
    scheduledAt: new Date(Date.now() - 7_200_000),
  });
  const workoutId = await openSessionWorkout(past.userId, pt.id);
  const record = await addRecord(past.userId, workoutId, { exerciseId });
  await addSet(past.userId, record!.record.id, {
    weight: 140,
    reps: 3,
    completed: true,
  });

  await prisma.trainerMemberConnection.update({
    where: { id: connection.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
}

/** 개인 운동을 관계가 시작되기 하루 전으로 옮긴다. */
async function moveBeforeConnection(sessionId: string, connectionId: string) {
  const { startedAt } = await prisma.trainerMemberConnection.findUniqueOrThrow({
    where: { id: connectionId },
    select: { startedAt: true },
  });

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { startedAt: new Date(startedAt.getTime() - 86_400_000) },
  });
}

describe("지난 기록 담기와 개인 운동 공유", () => {
  it("공유를 끈 회원의 개인 운동 값은 클라이언트가 ptOnly=false 를 보내도 담기지 않는다", async () => {
    const { trainer, recordId } = await setup();

    const result = await copyPreviousSets(trainer.userId, recordId, {
      ptOnly: false,
    });

    expect(result).toBeNull();

    expect(await prisma.workoutSet.count({ where: { recordId } })).toBe(0);
  });

  it("옵션을 아예 안 보내도 담기지 않는다", async () => {
    const { trainer, recordId } = await setup();

    expect(await copyPreviousSets(trainer.userId, recordId)).toBeNull();
  });

  it("회원이 공유를 켜면 개인 운동 값을 담을 수 있다", async () => {
    const { trainer, member, recordId } = await setup();

    await prisma.trainerSharingSetting.upsert({
      where: { userId: member.memberUserId },
      create: { userId: member.memberUserId, sharePersonalWorkout: true },
      update: { sharePersonalWorkout: true },
    });

    const result = await copyPreviousSets(trainer.userId, recordId, {
      ptOnly: false,
    });

    expect(result?.sets).toHaveLength(1);
    expect(result?.sets[0]).toMatchObject({ weight: 100, reps: 5 });
  });
});

describe("수업에서 참고하는 지난 기록의 범위", () => {
  it("공유를 끈 회원은 힌트에도 개인 운동이 나오지 않는다", async () => {
    const { trainer, ptSessionId, exerciseId } = await setup();

    const hints = await getSessionHints(trainer.userId, ptSessionId, [exerciseId]);

    expect(hints.ptOnly).toBe(true);
    expect(hints.records).toEqual([null]);
  });

  it("다른 트레이너와 한 PT 기록은 힌트로도 담기로도 넘어오지 않는다", async () => {
    const { trainer, member, recordId, ptSessionId, exerciseId } = await setup();
    await addPastTrainerRecord(member.memberUserId, exerciseId);

    const off = await getSessionHints(trainer.userId, ptSessionId, [exerciseId]);
    expect(off.records).toEqual([null]);
    expect(await copyPreviousSets(trainer.userId, recordId)).toBeNull();

    // 공유를 켜도 보이는 것은 회원의 개인 운동(100kg)이지 남의 수업(140kg)이 아니다.
    await sharePersonal(member.memberUserId);

    const on = await getSessionHints(trainer.userId, ptSessionId, [exerciseId]);
    expect(on.ptOnly).toBe(false);
    expect(on.records[0]?.sets).toHaveLength(1);
    expect(on.records[0]?.sets[0]).toMatchObject({ weight: 100, reps: 5 });
  });

  it("관계가 시작되기 전의 개인 운동은 공유를 켜도 보이지 않는다", async () => {
    const { trainer, member, recordId, ptSessionId, exerciseId, personalSessionId } =
      await setup();

    await sharePersonal(member.memberUserId);
    await moveBeforeConnection(personalSessionId, member.connectionId);

    const hints = await getSessionHints(trainer.userId, ptSessionId, [exerciseId]);
    expect(hints.records).toEqual([null]);

    expect(
      await copyPreviousSets(trainer.userId, recordId, { ptOnly: false }),
    ).toBeNull();
  });

  it("남의 수업은 힌트를 읽을 수 없다", async () => {
    const { ptSessionId, exerciseId } = await setup();
    const stranger = await makeTrainer();

    await expect(
      getSessionHints(stranger.userId, ptSessionId, [exerciseId]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("회원 상세의 부위 통계", () => {
  it("공유 여부를 서비스가 직접 보고, 다른 트레이너의 수업과 관계 전 기록은 세지 않는다", async () => {
    const { trainer, member, exerciseId, personalSessionId } = await setup();
    await addPastTrainerRecord(member.memberUserId, exerciseId);

    // 공유를 껐다: 내 PT 수업에는 아직 세트가 없으니 셀 것이 없다.
    const off = await getMemberStats(trainer.userId, member.connectionId);
    expect(off.bodyPartSets).toEqual([]);
    expect(off.personalThisMonth).toBeNull();

    // 공유를 켰다: 회원의 개인 운동 한 세트만 센다. 남의 수업 세트는 빠진다.
    await sharePersonal(member.memberUserId);
    const on = await getMemberStats(trainer.userId, member.connectionId);
    expect(on.bodyPartSets).toEqual([{ bodyPart: "BACK", sets: 1 }]);
    expect(on.personalThisMonth).toBe(1);

    // 관계가 시작되기 전의 개인 운동은 켜 둬도 세지 않는다.
    await moveBeforeConnection(personalSessionId, member.connectionId);
    const before = await getMemberStats(trainer.userId, member.connectionId);
    expect(before.bodyPartSets).toEqual([]);
    expect(before.personalThisMonth).toBe(0);
  });
});

import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteMyAccount } from "@/server/account/delete-account.service";
import {
  createCustomExercise,
  deleteCustomExercise,
  updateCustomExercise,
} from "@/server/exercises/custom-exercise.service";
import { MAX_CUSTOM_EXERCISES } from "@/server/exercises/custom-exercise.schema";
import {
  getBodyPartCounts,
  getExerciseById,
  getExercises,
} from "@/server/exercises/exercise.service";
import { setFavorite } from "@/server/workouts/favorite.service";
import {
  WorkoutError,
  addRecord,
  addRecords,
  startSession,
} from "@/server/workouts/workout.service";

import { uniq } from "./helpers";

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email: `ce-${uniq()}@test.com`,
      passwordHash: await bcrypt.hash("pw123456", 4),
      memberProfile: { create: {} },
    },
    select: { id: true },
  });
  return user.id;
}

async function create(userId: string, name: string, bodyPart = "LEG") {
  const result = await createCustomExercise(userId, { name, bodyPart });
  if (!result.ok) throw new Error(result.message);
  return result.exercise;
}

const list = (viewerId: string, search?: string) => getExercises({ viewerId, search, limit: 100 });

describe("직접 만든 운동: 만들기", () => {
  it("이름과 부위로 만들고, 난이도·동작은 자리표시 값으로 둔다", async () => {
    const userId = await makeUser();
    const name = `내 운동 ${uniq()}`;
    const exercise = await create(userId, `  ${name}  `, "GLUTE");
    expect(exercise.name).toBe(name);

    const row = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(row).toMatchObject({
      isSystem: false,
      isActive: true,
      createdByUserId: userId,
      bodyPart: "GLUTE",
      movementType: "OTHER",
      difficulty: "BEGINNER",
    });
  });

  it("이름 가운데 공백은 한 칸으로, 빈 이름·너무 긴 이름·없는 부위는 거절한다", async () => {
    const userId = await makeUser();
    const tag = uniq();
    expect((await create(userId, `케이블   힙\n어브덕션 ${tag}`)).name).toBe(`케이블 힙 어브덕션 ${tag}`);

    expect(await createCustomExercise(userId, { name: "   ", bodyPart: "LEG" })).toEqual({
      ok: false,
      message: "운동 이름을 입력해주세요.",
    });
    expect(await createCustomExercise(userId, { name: "가".repeat(41), bodyPart: "LEG" })).toEqual({
      ok: false,
      message: "운동 이름은 40자 이하로 입력해주세요.",
    });
    expect(await createCustomExercise(userId, { name: `x${uniq()}`, bodyPart: "NOPE" })).toEqual({
      ok: false,
      message: "부위를 골라주세요.",
    });
    expect(await createCustomExercise(userId, { name: `x${uniq()}`, bodyPart: "LEG", description: "가".repeat(501) })).toEqual({
      ok: false,
      message: "메모는 500자 이하로 입력해주세요.",
    });
  });

  it("같은 이름은 두 번 만들 수 없고(대소문자 무시), 라이브러리에 있는 이름도 안 된다", async () => {
    const userId = await makeUser();
    const name = `Hip Thrust ${uniq()}`;
    await create(userId, name);

    expect(await createCustomExercise(userId, { name: name.toUpperCase(), bodyPart: "GLUTE" })).toEqual({
      ok: false,
      message: "이미 만든 운동이에요.",
    });

    const systemName = `시스템운동 ${uniq()}`;
    await prisma.exercise.create({
      data: { name: systemName, bodyPart: "CHEST", movementType: "PUSH", difficulty: "BEGINNER" },
    });
    expect(await createCustomExercise(userId, { name: systemName, bodyPart: "CHEST" })).toEqual({
      ok: false,
      message: "라이브러리에 이미 있는 운동이에요. 검색해서 골라주세요.",
    });
  });

  it("다른 사람이 같은 이름으로 만드는 것은 막지 않는다", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const name = `겹치는 이름 ${uniq()}`;
    const first = await create(a, name);
    const second = await create(b, name);
    expect(second.id).not.toBe(first.id);
  });

  it("동시에 같은 이름을 만들어도 하나만 생긴다", async () => {
    const userId = await makeUser();
    const name = `동시 ${uniq()}`;
    const results = await Promise.all([1, 2, 3].map(() => createCustomExercise(userId, { name, bodyPart: "ARM" })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.exercise.count({ where: { createdByUserId: userId, name } })).toBe(1);
  });

  it(`${MAX_CUSTOM_EXERCISES}개를 넘게 만들 수 없다`, async () => {
    const userId = await makeUser();
    await prisma.exercise.createMany({
      data: Array.from({ length: MAX_CUSTOM_EXERCISES }, (_, index) => ({
        name: `일괄 ${index} ${uniq()}`,
        bodyPart: "ARM" as const,
        movementType: "OTHER" as const,
        difficulty: "BEGINNER" as const,
        isSystem: false,
        createdByUserId: userId,
      })),
    });

    const result = await createCustomExercise(userId, { name: `하나 더 ${uniq()}`, bodyPart: "ARM" });
    expect(result.ok).toBe(false);
  });
});

describe("직접 만든 운동: 누구에게 보이는가", () => {
  it("만든 사람의 목록·검색·부위 개수에만 나오고, 남에게는 없는 운동이다", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const name = `비밀운동 ${uniq()}`;
    const exercise = await create(owner, name, "BACK");

    expect((await list(owner, name)).data.map((item) => item.id)).toEqual([exercise.id]);
    expect((await list(other, name)).data).toEqual([]);

    expect((await list(owner, name)).data[0]).toMatchObject({ isCustom: true, createdByUserId: owner });
    expect((await list(owner)).data.some((item) => item.id === exercise.id)).toBe(true);
    expect((await list(other)).data.some((item) => item.id === exercise.id)).toBe(false);

    expect((await getExerciseById(exercise.id, owner))?.name).toBe(name);
    expect(await getExerciseById(exercise.id, other)).toBeNull();

    // 부위별 개수에도 내 운동만 더해진다.
    const mine = await getBodyPartCounts(owner);
    const theirs = await getBodyPartCounts(other);
    expect((mine.BACK ?? 0) - (theirs.BACK ?? 0)).toBe(1);
  });

  it("내 운동만 모아 볼 수 있다", async () => {
    const userId = await makeUser();
    const exercise = await create(userId, `모아보기 ${uniq()}`);
    const result = await getExercises({ viewerId: userId, customOnly: true, limit: 100 });
    expect(result.data.map((item) => item.id)).toEqual([exercise.id]);
  });

  it("남의 운동은 기록에 넣을 수도 즐겨찾기에 넣을 수도 없다", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const exercise = await create(owner, `남의운동 ${uniq()}`);

    const session = await startSession(other, { mode: "new" });
    const sessionId = session.session!.id;

    await expect(addRecord(other, sessionId, { exerciseId: exercise.id })).rejects.toBeInstanceOf(WorkoutError);
    await expect(addRecords(other, sessionId, [exercise.id])).rejects.toBeInstanceOf(WorkoutError);
    expect(await setFavorite(other, exercise.id, true)).toBeNull();
    expect(await prisma.workoutRecord.count({ where: { exerciseId: exercise.id } })).toBe(0);
  });

  it("내 운동은 기록에 넣고 즐겨찾기도 할 수 있다", async () => {
    const owner = await makeUser();
    const exercise = await create(owner, `내기록 ${uniq()}`);
    const sessionId = (await startSession(owner, { mode: "new" })).session!.id;

    expect(await addRecord(owner, sessionId, { exerciseId: exercise.id })).not.toBeNull();
    expect(await setFavorite(owner, exercise.id, true)).toBe(true);
  });

  it("내 기록에 들어 있는 운동은 상세를 열 수 있다(트레이너가 만든 운동을 PT 기록에서 눌렀을 때)", async () => {
    const [trainerish, member] = [await makeUser(), await makeUser()];
    const exercise = await create(trainerish, `수업운동 ${uniq()}`);
    const session = await prisma.workoutSession.create({
      data: { userId: member, startedAt: new Date(), status: "COMPLETED" },
      select: { id: true },
    });
    await prisma.workoutRecord.create({
      data: { sessionId: session.id, userId: member, exerciseId: exercise.id, orderIndex: 0 },
    });

    expect(await getExerciseById(exercise.id, member)).not.toBeNull();
    // 그래도 목록에서 고를 수는 없다.
    expect((await list(member, exercise.name)).data).toEqual([]);
  });
});

describe("직접 만든 운동: 수정과 삭제", () => {
  it("만든 사람만 고치고, 남의 운동이나 라이브러리 운동은 없는 운동으로 답한다", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const exercise = await create(owner, `수정전 ${uniq()}`);
    const newName = `수정후 ${uniq()}`;

    expect(await updateCustomExercise(other, exercise.id, { name: newName, bodyPart: "ARM" })).toEqual({
      ok: false,
      message: "운동을 찾을 수 없어요.",
    });

    const updated = await updateCustomExercise(owner, exercise.id, {
      name: newName,
      bodyPart: "ARM",
      targetMuscle: "상완이두",
      description: "천천히",
    });
    expect(updated).toMatchObject({ ok: true, exercise: { id: exercise.id, name: newName, bodyPart: "ARM" } });
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })).toMatchObject({
      targetMuscle: "상완이두",
      description: "천천히",
    });

    const system = await prisma.exercise.create({
      data: { name: `시스템 ${uniq()}`, bodyPart: "CHEST", movementType: "PUSH", difficulty: "BEGINNER" },
      select: { id: true },
    });
    expect((await updateCustomExercise(owner, system.id, { name: `x${uniq()}`, bodyPart: "ARM" })).ok).toBe(false);
    expect((await deleteCustomExercise(owner, system.id)).ok).toBe(false);
  });

  it("이름을 내 다른 운동과 같게 바꿀 수 없다", async () => {
    const owner = await makeUser();
    const first = await create(owner, `첫째 ${uniq()}`);
    const second = await create(owner, `둘째 ${uniq()}`);
    expect(await updateCustomExercise(owner, second.id, { name: first.name, bodyPart: "ARM" })).toEqual({
      ok: false,
      message: "이미 만든 운동이에요.",
    });
    // 자기 이름 그대로 저장하는 것은 된다.
    expect((await updateCustomExercise(owner, second.id, { name: second.name, bodyPart: "ABS" })).ok).toBe(true);
  });

  it("기록에 쓴 적이 없으면 지우고, 쓴 적이 있으면 숨기기만 한다", async () => {
    const owner = await makeUser();
    const unused = await create(owner, `안쓴운동 ${uniq()}`);
    const used = await create(owner, `쓴운동 ${uniq()}`);
    const sessionId = (await startSession(owner, { mode: "new" })).session!.id;
    await addRecord(owner, sessionId, { exerciseId: used.id });

    expect(await deleteCustomExercise(owner, unused.id)).toEqual({ ok: true, exercise: null });
    expect(await prisma.exercise.count({ where: { id: unused.id } })).toBe(0);

    expect(await deleteCustomExercise(owner, used.id)).toEqual({ ok: true, exercise: null });
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: used.id } })).toMatchObject({ isActive: false });

    // 숨긴 운동은 목록에서 빠지지만 기록 화면에서 이름은 그대로 열린다.
    expect((await list(owner, used.name)).data).toEqual([]);
    expect((await getExerciseById(used.id, owner))?.isActive).toBe(false);
    await expect(addRecord(owner, sessionId, { exerciseId: used.id })).rejects.toBeInstanceOf(WorkoutError);
  });

  it("지운 운동과 같은 이름으로 다시 만들면 되살아난다", async () => {
    const owner = await makeUser();
    const name = `되살리기 ${uniq()}`;
    const first = await create(owner, name, "LEG");
    const sessionId = (await startSession(owner, { mode: "new" })).session!.id;
    await addRecord(owner, sessionId, { exerciseId: first.id });
    await deleteCustomExercise(owner, first.id);

    const again = await create(owner, name, "ARM");
    expect(again.id).toBe(first.id);
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      isActive: true,
      bodyPart: "ARM",
    });
  });
});

describe("직접 만든 운동: 탈퇴", () => {
  it("쓰지 않은 운동은 지우고, PT 기록에 남은 운동은 숨긴다", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const unused = await create(owner, `탈퇴안씀 ${uniq()}`);
    const used = await create(owner, `탈퇴씀 ${uniq()}`);

    // 다른 사람의 기록(PT 수업 등)에 들어간 운동
    const session = await prisma.workoutSession.create({
      data: { userId: other, startedAt: new Date(), status: "COMPLETED" },
      select: { id: true },
    });
    await prisma.workoutRecord.create({
      data: { sessionId: session.id, userId: other, exerciseId: used.id, orderIndex: 0 },
    });

    expect(await deleteMyAccount(owner, "pw123456")).toEqual({ ok: true });

    expect(await prisma.exercise.count({ where: { id: unused.id } })).toBe(0);
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: used.id } })).toMatchObject({ isActive: false });
    // 다른 사람의 기록은 그대로다.
    expect(await prisma.workoutRecord.count({ where: { exerciseId: used.id } })).toBe(1);
  });
});

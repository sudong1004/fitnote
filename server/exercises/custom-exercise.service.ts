import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import {
  CustomExerciseSchema,
  MAX_CUSTOM_EXERCISES,
} from "./custom-exercise.schema";

/**
 * 사용자가 직접 만드는 운동.
 *
 * 라이브러리에 없는 운동(회사 전용 머신, 트레이너만 쓰는 이름 등)을 적어 둘 수 있게 한다.
 * 만든 사람에게만 보이고(`exercise-access.ts`), 시스템 운동과 같은 자리에서 고르고 기록한다.
 * 난이도와 동작 유형은 사용자가 정하는 값이 아니어서 자리표시 값(초급, 기타)으로 두고 화면에서 숨긴다.
 */

export type CustomExerciseResult =
  | { ok: true; exercise: { id: string; name: string; bodyPart: WorkoutBodyPart } }
  | { ok: false; message: string };

const DUPLICATE_OWN = "이미 만든 운동이에요.";
const DUPLICATE_SYSTEM = "라이브러리에 이미 있는 운동이에요. 검색해서 골라주세요.";
const NOT_FOUND = "운동을 찾을 수 없어요.";

const fail = (message: string): CustomExerciseResult => ({ ok: false, message });

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

function parse(input: unknown) {
  const parsed = CustomExerciseSchema.safeParse(input);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, message: parsed.error.issues[0]?.message ?? "입력을 확인해주세요." };
}

/** 같은 이름이 라이브러리나 내 운동에 이미 있는지. 대소문자는 구분하지 않는다. */
async function findNameConflict(userId: string, name: string, exceptId?: string) {
  const same = await prisma.exercise.findFirst({
    where: {
      isActive: true,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      OR: [{ createdByUserId: null }, { createdByUserId: userId }],
    },
    select: { createdByUserId: true },
  });

  if (!same) return null;
  return same.createdByUserId === null ? DUPLICATE_SYSTEM : DUPLICATE_OWN;
}

export async function createCustomExercise(userId: string, input: unknown): Promise<CustomExerciseResult> {
  const parsed = parse(input);
  if (!parsed.ok) return fail(parsed.message);
  const { name, bodyPart, targetMuscle, description } = parsed.data;

  const conflict = await findNameConflict(userId, name);
  if (conflict) return fail(conflict);

  const count = await prisma.exercise.count({ where: { createdByUserId: userId, isActive: true } });
  if (count >= MAX_CUSTOM_EXERCISES) {
    return fail(`직접 만든 운동은 ${MAX_CUSTOM_EXERCISES}개까지 만들 수 있어요. 안 쓰는 운동을 지워 주세요.`);
  }

  const data = { bodyPart, targetMuscle, description };

  try {
    // 지웠던 운동과 같은 이름이면 그 운동을 되살린다(지운 운동도 이름 자리를 차지한다).
    const revived = await prisma.exercise.findFirst({
      where: { createdByUserId: userId, name, isActive: false },
      select: { id: true },
    });

    const exercise = revived
      ? await prisma.exercise.update({
          where: { id: revived.id },
          data: { ...data, isActive: true },
          select: { id: true, name: true, bodyPart: true },
        })
      : await prisma.exercise.create({
          data: {
            name,
            ...data,
            // 사용자가 정하는 값이 아니다. 목록에서는 보이지 않는다.
            movementType: "OTHER",
            difficulty: "BEGINNER",
            isSystem: false,
            createdByUserId: userId,
          },
          select: { id: true, name: true, bodyPart: true },
        });

    return { ok: true, exercise };
  } catch (error) {
    // 확인과 생성 사이에 같은 이름이 만들어진 경우(버튼을 두 번 누른 경우 포함).
    if (isUniqueViolation(error)) return fail(DUPLICATE_OWN);
    throw error;
  }
}

export async function updateCustomExercise(
  userId: string,
  exerciseId: string,
  input: unknown,
): Promise<CustomExerciseResult> {
  const parsed = parse(input);
  if (!parsed.ok) return fail(parsed.message);
  const { name, bodyPart, targetMuscle, description } = parsed.data;

  // 내가 만든, 지우지 않은 운동만 고친다. 남의 운동과 없는 운동은 같은 답이다.
  const own = await prisma.exercise.findFirst({
    where: { id: exerciseId, createdByUserId: userId, isSystem: false, isActive: true },
    select: { id: true },
  });
  if (!own) return fail(NOT_FOUND);

  const conflict = await findNameConflict(userId, name, own.id);
  if (conflict) return fail(conflict);

  try {
    const exercise = await prisma.exercise.update({
      where: { id: own.id },
      data: { name, bodyPart, targetMuscle, description },
      select: { id: true, name: true, bodyPart: true },
    });
    return { ok: true, exercise };
  } catch (error) {
    if (isUniqueViolation(error)) return fail(DUPLICATE_OWN);
    throw error;
  }
}

/**
 * 직접 만든 운동을 지운다.
 *
 * 기록이나 루틴에 쓴 적이 없으면 행을 지우고, 쓴 적이 있으면 숨기기만 한다. 지난 기록과 PT 수업의
 * 운동 이름이 사라지면 안 되기 때문이다.
 */
export async function deleteCustomExercise(userId: string, exerciseId: string): Promise<CustomExerciseResult | { ok: true; exercise: null }> {
  const own = await prisma.exercise.findFirst({
    where: { id: exerciseId, createdByUserId: userId, isSystem: false, isActive: true },
    select: { id: true },
  });
  if (!own) return fail(NOT_FOUND);

  await prisma.$transaction(async (tx) => {
    const [records, routines] = await Promise.all([
      tx.workoutRecord.count({ where: { exerciseId: own.id } }),
      tx.routineExercise.count({ where: { exerciseId: own.id } }),
    ]);

    if (records + routines === 0) {
      await tx.exercise.delete({ where: { id: own.id } });
    } else {
      await tx.exercise.update({ where: { id: own.id }, data: { isActive: false } });
    }
  });

  return { ok: true, exercise: null };
}

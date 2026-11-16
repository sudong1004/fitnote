"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import {
  createCustomExercise,
  deleteCustomExercise,
  updateCustomExercise,
} from "@/server/exercises/custom-exercise.service";
import { setFavorite } from "@/server/workouts/favorite.service";
import {
  addRecord,
  getActiveSession,
  startSession,
} from "@/server/workouts/workout.service";

/**
 * 이 운동을 오늘 운동에 넣고 바로 기록으로 간다.
 *
 * 운동 라이브러리는 설명을 읽는 곳이 아니라 기록의 출발점이어야 한다. 여기서
 * "운동 시작 → 운동 추가 → 검색 → 이 운동 찾기" 를 다시 하게 만들면, 방금 보고 있던
 * 운동을 처음부터 다시 찾는 셈이다.
 *
 * 진행 중인 운동이 있으면 거기에 넣는다. 새 세션을 만들면 하루가 두 개로 쪼개지고
 * 진행 중 타이머도 둘이 된다.
 */
export async function recordThisExercise(formData: FormData) {
  const user = await requireUser();
  const exerciseId = String(formData.get("exerciseId") ?? "");

  const active = await getActiveSession(user.id);

  let sessionId = active?.id ?? null;

  if (sessionId === null) {
    const started = await startSession(user.id);
    // 진행 중인 세션이 없는 걸 확인하고 부르므로 충돌이 날 수 없다.
    sessionId = started.conflict
      ? (started.activeSession?.id ?? null)
      : (started.session?.id ?? null);
  }

  if (sessionId === null) {
    redirect("/home");
  }

  const already = active?.records.some(
    (record) => record.exercise.id === exerciseId,
  );

  if (!already) {
    await addRecord(user.id, sessionId, { exerciseId });
  }

  revalidatePath("/home");
  redirect(`/workouts/${sessionId}`);
}

export async function toggleFavorite(formData: FormData) {
  const user = await requireUser();

  const exerciseId = String(formData.get("exerciseId") ?? "");
  const on = formData.get("on") === "1";

  await setFavorite(user.id, exerciseId, on);

  revalidatePath(`/exercises/${exerciseId}`);
  revalidatePath("/exercises");
}

// ---------------------------------------------------------------------------
// 직접 만드는 운동
// ---------------------------------------------------------------------------

export type ExerciseFormState = { message?: string } | undefined;

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/**
 * 운동 선택창에서 바로 만든다.
 *
 * 찾는 운동이 없을 때 지금 하던 기록을 떠나지 않고 만들 수 있어야 해서, 화면을 옮기지 않고 결과만
 * 돌려준다. 이름과 부위만 받는다(나머지는 나중에 수정 화면에서).
 */
export async function createExerciseInline(input: {
  name: string;
  bodyPart: WorkoutBodyPart;
}): Promise<
  | { error: string; exercise?: undefined }
  | { error: null; exercise: { id: string; name: string; bodyPart: WorkoutBodyPart } }
> {
  const user = await requireUser();
  const result = await createCustomExercise(user.id, {
    name: String(input?.name ?? ""),
    bodyPart: input?.bodyPart,
  });

  if (!result.ok) return { error: result.message };

  revalidatePath("/exercises");
  return { error: null, exercise: result.exercise };
}

/** 운동 만들기·수정 화면의 저장. `id` 가 있으면 수정, 없으면 새로 만든다. */
export async function saveExercise(
  _state: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const user = await requireUser();
  const id = field(formData, "id");

  const input = {
    name: field(formData, "name"),
    bodyPart: field(formData, "bodyPart"),
    targetMuscle: field(formData, "targetMuscle"),
    description: field(formData, "description"),
  };

  const result = id
    ? await updateCustomExercise(user.id, id, input)
    : await createCustomExercise(user.id, input);

  if (!result.ok) return { message: result.message };

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${result.exercise.id}`);
  redirect(`/exercises/${result.exercise.id}`);
}

export async function removeExercise(formData: FormData) {
  const user = await requireUser();

  await deleteCustomExercise(user.id, field(formData, "exerciseId"));

  revalidatePath("/exercises");
  redirect("/exercises?custom=1");
}

"use client";

import { useActionState } from "react";

import { useSubmitKeep } from "@/app/lib/use-submit-keep";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import { BODY_PART_OPTIONS } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import { saveExercise } from "./actions";

const inputClass =
  "h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-4 text-[0.9375rem] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-ring/30";

export type ExerciseFormDefaults = {
  id?: string;
  name: string;
  bodyPart: WorkoutBodyPart | null;
  targetMuscle: string | null;
  description: string | null;
};

/**
 * 직접 만드는 운동의 입력 폼(만들기·수정 공용).
 * 이름과 부위만 필수다. 난이도·동작 유형·기구는 사용자가 정하는 값이 아니라서 묻지 않는다.
 */
export function ExerciseForm({ defaults }: { defaults: ExerciseFormDefaults }) {
  const [state, action, pending] = useActionState(saveExercise, undefined);
  const onSubmit = useSubmitKeep(action);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-[1.375rem] border border-border p-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[0.8125rem] font-bold">운동 이름</span>
        <input
          name="name"
          defaultValue={defaults.name}
          required
          maxLength={40}
          placeholder="예: 케이블 힙 어브덕션"
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="px-1 pb-1.5 text-[0.8125rem] font-bold">부위</legend>
        <div className="flex flex-wrap gap-2">
          {BODY_PART_OPTIONS.map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="bodyPart"
                value={value}
                defaultChecked={defaults.bodyPart === value}
                required
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-9 items-center rounded-full border border-border px-3.5 text-[0.8125rem] font-bold text-foreground",
                  "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40",
                )}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[0.8125rem] font-bold">
          자극 부위 <span className="font-normal text-muted-foreground">(선택)</span>
        </span>
        <input
          name="targetMuscle"
          defaultValue={defaults.targetMuscle ?? ""}
          maxLength={30}
          placeholder="예: 중둔근"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[0.8125rem] font-bold">
          메모 <span className="font-normal text-muted-foreground">(선택)</span>
        </span>
        <textarea
          name="description"
          defaultValue={defaults.description ?? ""}
          maxLength={500}
          rows={3}
          placeholder="자세 팁이나 세팅 방법을 적어 두세요"
          className={cn(inputClass, "h-auto py-3 leading-relaxed")}
        />
      </label>

      {state?.message ? (
        <p role="alert" className="px-1 text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 items-center justify-center rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "저장하는 중..." : defaults.id ? "저장하기" : "운동 만들기"}
      </button>
    </form>
  );
}

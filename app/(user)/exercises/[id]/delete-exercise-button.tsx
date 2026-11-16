"use client";

import { useState } from "react";

import { removeExercise } from "../actions";

/** 두 번 눌러야 지운다. 브라우저 확인창은 쓰지 않는다(홈 화면 앱에서 막힐 수 있다). */
export function DeleteExerciseButton({ exerciseId }: { exerciseId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold text-status-urgent"
      >
        삭제
      </button>
    );
  }

  return (
    <form action={removeExercise} className="flex flex-1 items-center gap-2">
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <button
        type="submit"
        className="flex h-11 flex-1 items-center justify-center rounded-full bg-status-urgent text-sm font-bold text-white"
      >
        정말 지우기
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="flex h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-bold"
      >
        취소
      </button>
    </form>
  );
}

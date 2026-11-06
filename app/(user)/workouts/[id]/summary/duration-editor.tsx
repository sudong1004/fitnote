"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { updateWorkoutDuration } from "../../actions";

/**
 * 운동 시간 고치기.
 *
 * 시간은 마지막으로 기록한 때까지를 기준으로 자동 계산한다. 실제와 다르면(오래 쉬었다 끝냈거나,
 * 몰아서 적은 기록에 시간이 없을 때) 여기서 분 단위로 고친다.
 */
export function DurationEditor({
  sessionId,
  initialMinutes,
}: {
  sessionId: string;
  initialMinutes: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(
    initialMinutes === null ? "" : String(initialMinutes),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const parsed = Number(minutes);

    if (minutes.trim() === "" || !Number.isInteger(parsed)) {
      setError("운동 시간은 분 단위 숫자로 적어 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await updateWorkoutDuration(sessionId, parsed);

      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-xs font-bold text-muted-foreground underline underline-offset-2"
      >
        {initialMinutes === null ? "운동 시간 적기" : "시간이 다르면 고치기"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-[#f7f8f7] px-3.5 py-3">
      <label className="flex items-center justify-between gap-2.5">
        <span className="text-[0.8125rem] font-bold">운동 시간</span>
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            aria-label="운동 시간(분) 고치기"
            className="h-9 w-20 rounded-full bg-card text-center text-sm font-bold tabular-nums"
          />
          <span className="text-sm text-muted-foreground">분</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="h-10 flex-1 rounded-full border border-border text-sm font-bold"
        >
          취소
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-bold text-white"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          저장
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

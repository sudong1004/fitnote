"use client";

import { Check, ChevronRight, History, Loader2, Plus, X } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import {
  BODY_PART_MUSCLES,
  MuscleFigure,
  levelsForBodyPart,
} from "@/components/fitness/muscle-figure";
import { BODY_PART_LABEL } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import {
  addSetToRecord,
  copyPreviousSetsAction,
  removeExerciseFromSession,
  removeSet,
  updateSetValues,
} from "../actions";

export type SetDto = {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
};

export type RecordDto = {
  id: string;
  totalVolume: number | null;
  exercise: {
    name: string;
    bodyPart: keyof typeof BODY_PART_LABEL;
    targetMuscle?: string | null;
  };
  sets: SetDto[];
};

export type PreviousRecord = {
  performedAt: string;
  sets: {
    weight: number | null;
    reps: number | null;
  }[];
} | null;

/** 숫자 입력을 서비스가 받는 값으로 바꾼다. 빈 칸은 null. */
function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "60kg × 10회 · 4세트" 처럼 지난 기록을 한 줄로. 세트마다 다르면 앞의 몇 개만. */
function summarizePrevious(sets: { weight: number | null; reps: number | null }[]) {
  if (sets.length === 0) return "";
  const [first] = sets;
  const same = sets.every((set) => set.weight === first.weight && set.reps === first.reps);
  if (same) {
    return `${first.weight ?? 0}kg × ${first.reps ?? 0}회 · ${sets.length}세트`;
  }
  const head = sets
    .slice(0, 3)
    .map((set) => `${set.weight ?? "-"}×${set.reps ?? "-"}`)
    .join(" · ");
  return sets.length > 3 ? `${head} 외 ${sets.length - 3}세트` : head;
}

function formatShortDate(iso: string) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

const SET_GRID = "grid grid-cols-[2.125rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem_1.75rem] items-center gap-1.5";

type SetPatch = { weight: number | null; reps: number | null; completed: boolean };

type SetChange =
  | { type: "add"; set: SetDto }
  | { type: "update"; id: string; patch: SetPatch }
  | { type: "remove"; id: string };

/** 서버 응답을 기다리지 않고 화면에 먼저 그릴 세트 목록. 실패하면 React 가 원래 목록으로 돌린다. */
function applySetChange(sets: SetDto[], change: SetChange): SetDto[] {
  switch (change.type) {
    case "add":
      return [...sets, change.set];
    case "update":
      return sets.map((set) => (set.id === change.id ? { ...set, ...change.patch } : set));
    case "remove":
      // 서버도 지운 뒤 번호를 1부터 다시 매긴다. 화면도 같은 번호로 보여 준다.
      return sets
        .filter((set) => set.id !== change.id)
        .map((set, index) => ({ ...set, setNumber: index + 1 }));
  }
}

function SetRow({
  set,
  onSave,
  onRemove,
  showCompleteToggle,
}: {
  set: SetDto;
  onSave: (patch: SetPatch) => void;
  onRemove: () => void;
  showCompleteToggle: boolean;
}) {
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");

  /*
    저장이 실패해 값이 되돌아가면 칸도 따라 되돌린다.
    값이 같을 때는 건드리지 않아서, 다른 세트가 저장되며 화면이 새로 그려져도
    지금 적고 있는 칸은 그대로 남는다.
  */
  const [shown, setShown] = useState({ weight: set.weight, reps: set.reps });
  if (shown.weight !== set.weight || shown.reps !== set.reps) {
    setShown({ weight: set.weight, reps: set.reps });
    setWeight(set.weight?.toString() ?? "");
    setReps(set.reps?.toString() ?? "");
  }

  function save(next: { completed?: boolean }) {
    const patch = {
      weight: toNumberOrNull(weight),
      reps: toNumberOrNull(reps),
      completed: next.completed ?? set.completed,
    };
    if (patch.weight === set.weight && patch.reps === set.reps && patch.completed === set.completed) {
      return;
    }
    onSave(patch);
  }

  // 완료한 세트는 민트, 아직인 세트는 흰 칸에 테두리. 지금 적을 차례인 칸이 눈에 띈다.
  const inputClass = cn(
    "h-10.5 min-w-0 rounded-xl text-center text-base font-extrabold tabular-nums outline-none",
    "focus:ring-2 focus:ring-ring/50",
    set.completed
      ? "bg-brand-muted text-primary"
      : "bg-card text-ink ring-[1.5px] ring-border ring-inset",
  );

  return (
    <li className={SET_GRID}>
      <span
        className={cn(
          "text-center text-sm font-extrabold tabular-nums",
          set.completed ? "text-primary" : "text-ink",
        )}
      >
        {set.setNumber}
      </span>

      <input
        inputMode="decimal"
        value={weight}
        aria-label={`${set.setNumber}세트 중량(kg)`}
        onChange={(event) => setWeight(event.target.value)}
        onBlur={() => save({})}
        className={inputClass}
      />

      <input
        inputMode="numeric"
        value={reps}
        aria-label={`${set.setNumber}세트 횟수`}
        onChange={(event) => setReps(event.target.value)}
        onBlur={() => save({})}
        className={inputClass}
      />

      {showCompleteToggle ? (
        <button
          type="button"
          aria-label={set.completed ? `${set.setNumber}세트 완료 취소` : `${set.setNumber}세트 완료`}
          aria-pressed={set.completed}
          onClick={() => save({ completed: !set.completed })}
          className={cn(
            "mx-auto flex size-9.5 items-center justify-center rounded-full transition-colors",
            set.completed ? "bg-primary text-white" : "bg-surface text-[#8a938e]",
          )}
        >
          <Check className="size-4" strokeWidth={2.8} />
        </button>
      ) : (
        <span />
      )}

      <button
        type="button"
        aria-label={`${set.setNumber}세트 삭제`}
        onClick={onRemove}
        className="flex size-7 items-center justify-center rounded-full text-[#8a938e] hover:bg-surface hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

/**
 * 접힌 운동 한 줄. 진행 중인 운동에서 지금 하지 않는 운동은 이렇게 접어 둬서
 * 화면에 입력칸이 한 운동 것만 보이게 한다. 누르면 펼쳐진다.
 */
export function CollapsedRecord({
  record,
  index,
  onExpand,
}: {
  record: RecordDto;
  index: number;
  onExpand: () => void;
}) {
  const done = record.sets.length > 0 && record.sets.every((set) => set.completed);

  return (
    <li>
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center gap-3 rounded-[1.125rem] bg-[#f7f8f7] px-3.5 py-3 text-left"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-extrabold",
            done ? "bg-primary text-white" : "bg-card text-muted-foreground",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={2.8} aria-label="완료" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{record.exercise.name}</span>
          <span className="block truncate text-xs text-muted-foreground tabular-nums">
            {record.sets.length > 0
              ? `${record.sets.length}세트${
                  record.totalVolume ? ` · ${record.totalVolume.toLocaleString()}kg` : ""
                }${done ? " · 완료" : ""}`
              : "아직 세트 없음 · 눌러서 시작"}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
      </button>
    </li>
  );
}

export function RecordCard({
  sessionId,
  record,
  previousRecord,
  editable,
  showCompleteToggle = true,
  ptOnly = false,
  focusLabel,
}: {
  sessionId: string;
  record: RecordDto;
  previousRecord: PreviousRecord;
  editable: boolean;
  showCompleteToggle?: boolean;
  ptOnly?: boolean;
  /** "2 / 3 · 지금 하는 운동". 있으면 강조 테두리와 근육 그림을 그린다. */
  focusLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /*
    세트 추가·완료·값 수정·삭제는 누르는 즉시 화면에 반영한다.
    체육관처럼 신호가 약한 곳에서 버튼마다 0.5초씩 멈추면 기록을 미루게 된다.
    서버 액션은 한 줄로 차례차례 실행되므로, 추가 직후 바로 적은 값도 그 세트에 저장된다.
  */
  const [sets, applyChange] = useOptimistic(record.sets, applySetChange);
  const [, startSetTransition] = useTransition();

  function changeSet(change: SetChange, send: () => Promise<{ error: string | null }>) {
    setError(null);
    startSetTransition(async () => {
      applyChange(change);
      const result = await send();
      // 실패하면 React 가 화면을 서버 값으로 되돌린다. 무엇이 안 됐는지만 알려 준다.
      if (result.error) setError(result.error);
    });
  }

  function addSet() {
    const id = crypto.randomUUID();
    const defaults = nextSetDefaults();
    changeSet(
      {
        type: "add",
        // 서버도 값만 받은 새 세트를 완료로 저장한다.
        set: { id, setNumber: sets.length + 1, weight: defaults.weight, reps: defaults.reps, completed: true },
      },
      () => addSetToRecord(sessionId, record.id, defaults, id),
    );
  }

  function nextSetDefaults() {
    const lastSet = sets.at(-1);
    if (lastSet) return { weight: lastSet.weight, reps: lastSet.reps };
    const previous = previousRecord?.sets[0];
    return { weight: previous?.weight ?? null, reps: previous?.reps ?? null };
  }

  const previousSets = previousRecord?.sets ?? [];
  // 새 세트는 바로 앞 세트(없으면 지난 기록 첫 세트) 값을 그대로 받는다.
  // 대부분 같은 무게·횟수로 이어 가거나 조금만 올리기 때문에, 버튼에 미리 보여 준다.
  const nextDefaults = nextSetDefaults();
  const nextPreview =
    nextDefaults.weight !== null || nextDefaults.reps !== null
      ? `${nextDefaults.weight ?? 0}kg × ${nextDefaults.reps ?? 0}`
      : null;
  const hasPreviousSets = previousSets.length > 0;
  const muscles = BODY_PART_MUSCLES[record.exercise.bodyPart];
  const mainLabel = record.exercise.targetMuscle || BODY_PART_LABEL[record.exercise.bodyPart];
  const focused = Boolean(focusLabel);

  return (
    <li
      className={cn(
        "rounded-[1.375rem] bg-card p-3.5",
        focused ? "border-[1.5px] border-primary" : "border border-border",
      )}
    >
      {/* 운동 머리: 근육 그림 · 이름 · 주/보조 근육 */}
      <div className="flex items-center gap-3">
        {muscles.main.length > 0 ? (
          <MuscleFigure
            levels={levelsForBodyPart(record.exercise.bodyPart)}
            label={`주로 쓰는 근육: ${mainLabel}${
              muscles.assistLabels.length ? `, 보조: ${muscles.assistLabels.join("·")}` : ""
            }`}
            className={focused ? "h-28.5 w-15.5 shrink-0" : "h-20 w-11 shrink-0"}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {focusLabel ? (
            <span className="block text-[0.6875rem] font-bold text-primary">{focusLabel}</span>
          ) : null}
          <h2
            className={cn(
              "mt-0.5 truncate font-extrabold",
              focused ? "text-[1.1875rem]" : "text-base",
            )}
          >
            {record.exercise.name}
          </h2>
          <span className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-primary px-2.25 py-0.5 text-[0.6875rem] font-bold text-white">
              {mainLabel}
            </span>
            {muscles.assistLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-brand-mid px-2.25 py-px text-[0.6875rem] font-semibold text-primary"
              >
                {label}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* 지난 기록 */}
      {hasPreviousSets && previousRecord ? (
        <div className="mt-3 rounded-[0.875rem] bg-[#f7f8f7] px-3 py-2.5">
          <span className="block text-[0.6875rem] font-bold text-muted-foreground">
            지난 기록 · {formatShortDate(previousRecord.performedAt)}
          </span>
          <span className="mt-0.5 block truncate text-[0.8125rem] font-bold text-primary tabular-nums">
            {summarizePrevious(previousSets)}
          </span>
        </div>
      ) : null}

      {/* 세트 */}
      {sets.length > 0 ? (
        editable ? (
          <>
            <div
              className={cn(
                SET_GRID,
                "px-0.5 pt-3 pb-1.5 text-center text-[0.6875rem] text-faint",
              )}
            >
              <span>세트</span>
              <span>무게(kg)</span>
              <span>횟수</span>
              <span>{showCompleteToggle ? "완료" : ""}</span>
              <span />
            </div>
            <ul className="flex flex-col gap-1.5">
              {sets.map((set) => (
                <SetRow
                  key={set.id}
                  set={set}
                  showCompleteToggle={showCompleteToggle}
                  onSave={(patch) =>
                    changeSet({ type: "update", id: set.id, patch }, () =>
                      updateSetValues(sessionId, set.id, patch),
                    )
                  }
                  onRemove={() =>
                    changeSet({ type: "remove", id: set.id }, () => removeSet(sessionId, set.id))
                  }
                />
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {sets.map((set) => (
              <li key={set.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {set.setNumber}
                </span>
                <span className="font-bold tabular-nums">{set.weight ?? 0}kg</span>
                <span className="text-muted-foreground">×</span>
                <span className="font-bold tabular-nums">{set.reps ?? 0}회</span>
                {set.completed ? (
                  <Check className="ml-auto size-4 text-primary" aria-label="완료" />
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* 지난 기록 그대로 담기 */}
      {editable && sets.length === 0 && hasPreviousSets ? (
        <button
          type="button"
          className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border text-sm font-bold"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await copyPreviousSetsAction(sessionId, record.id, ptOnly);
              if (result.error) setError(result.error);
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
          지난 기록 {previousSets.length}세트 그대로 담기
        </button>
      ) : null}

      {editable ? (
        <div className="mt-2.5 flex gap-1.5">
          <button
            type="button"
            className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-dashed border-[#c4ccc7] text-[0.8125rem] font-bold text-primary"
            disabled={pending}
            onClick={addSet}
          >
            <Plus className="size-4" />
            세트 추가
            {nextPreview ? (
              <span className="font-semibold text-muted-foreground tabular-nums">· {nextPreview}</span>
            ) : null}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await removeExerciseFromSession(sessionId, record.id);
                if (result.error) setError(result.error);
              });
            }}
            className="flex h-10 shrink-0 items-center justify-center rounded-full border border-border px-3.5 text-xs font-semibold text-muted-foreground hover:bg-surface"
          >
            운동 삭제
          </button>
        </div>
      ) : (
        <div className="mt-2 flex justify-end text-sm font-bold tabular-nums">
          {(record.totalVolume ?? 0).toLocaleString()}
          <span className="ml-0.5 text-xs font-medium text-muted-foreground">kg</span>
        </div>
      )}
    </li>
  );
}

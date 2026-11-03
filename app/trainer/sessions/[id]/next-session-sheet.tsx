"use client";

import { useState } from "react";

import { Check } from "lucide-react";

import { SESSION_DURATION } from "@/lib/session-duration";
import { cn } from "@/lib/utils";

import type { NextSessionDay } from "@/server/pt/next-session.service";

import { scheduleNextSessionAction } from "./actions";

const fieldClass =
  "h-11.5 w-full min-w-0 rounded-[0.875rem] border border-border bg-background px-3 text-[0.9375rem] tabular-nums";

/**
 * 수업을 완료로 마친 직후 올라오는 "다음 수업도 잡을까요?" 시트.
 *
 * 날짜는 비워 두고 트레이너가 직접 누른다. 날짜 아래에는 그날 이미 잡힌 내
 * 수업 수를 적어서 빈 날을 바로 찾게 한다. 시각과 수업 시간만 오늘 수업과
 * 같게 채운다. "나중에" 를 누르면 닫히고 화면은 그대로다.
 */
export function NextSessionSheet({
  ptSessionId,
  contractId,
  memberName,
  usedLabel,
  remainingLabel,
  days,
  firstDateKey,
  defaultTime,
  defaultDuration,
  error,
}: {
  ptSessionId: string;
  contractId: string;
  memberName: string;
  usedLabel: string;
  remainingLabel: string;
  days: NextSessionDay[];
  firstDateKey: string;
  defaultTime: string;
  defaultDuration: number;
  error?: string;
}) {
  const [open, setOpen] = useState(true);
  const [date, setDate] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const chosen = days.find((day) => day.dateKey === date);
  const month = days[0]?.month;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/40"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-session-title"
        className="relative w-full max-w-md rounded-t-[1.625rem] bg-background px-4 pt-2.5"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto block h-1.25 w-10 rounded-full bg-border" aria-hidden />

        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-muted px-3 py-2.5">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          <span className="min-w-0 truncate text-[0.8125rem] text-primary">
            <b>{usedLabel} 완료</b> · {remainingLabel}
          </span>
        </div>

        <h2 id="next-session-title" className="mt-3.5 text-lg font-extrabold">
          다음 수업도 잡을까요?
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {memberName} 회원 · 날짜를 눌러 주세요. 날짜 아래 숫자는 그날 잡힌 내 수업 수예요.
        </p>

        <form
          action={scheduleNextSessionAction}
          onSubmit={() => setPending(true)}
          className="mt-3 flex flex-col gap-3"
        >
          <input type="hidden" name="ptSessionId" value={ptSessionId} />
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="date" value={date} />

          <div className="flex items-baseline justify-between px-0.5">
            <b className="text-sm">{chosen ? `${chosen.month}월` : `${month}월`}</b>
            <button
              type="button"
              onClick={() => setCalendar((value) => !value)}
              className="text-xs font-bold text-primary"
            >
              {calendar ? "날짜 줄로 고르기" : "달력으로 고르기 ›"}
            </button>
          </div>

          {calendar ? (
            <input
              type="date"
              aria-label="다음 수업 날짜"
              min={firstDateKey}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          ) : (
            <div
              role="radiogroup"
              aria-label="다음 수업 날짜"
              className="scroll-area -mr-4 flex gap-1.5 overflow-x-auto pr-4"
            >
              {days.map((day) => {
                const selected = day.dateKey === date;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${day.month}월 ${day.day}일 ${day.weekday}요일, 내 수업 ${day.count}개`}
                    onClick={() => setDate(day.dateKey)}
                    className={cn(
                      "flex h-17.5 w-13.5 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border",
                      selected
                        ? "border-ink bg-ink text-white"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    <span className={cn("text-[0.6875rem]", selected ? "text-white/75" : "text-muted-foreground")}>
                      {day.weekday}
                    </span>
                    <b className="text-[1.0625rem] leading-none tabular-nums">{day.day}</b>
                    <span className={cn("text-[0.6875rem] tabular-nums", selected ? "text-white/75" : "text-muted-foreground")}>
                      {day.count > 0 ? `수업 ${day.count}` : " "}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">시작 시각</span>
              <input type="time" name="time" step={300} defaultValue={defaultTime} required className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">수업 시간 (분)</span>
              <input
                type="number"
                name="durationMinutes"
                inputMode="numeric"
                min={SESSION_DURATION.min}
                max={SESSION_DURATION.max}
                step={SESSION_DURATION.step}
                defaultValue={defaultDuration}
                required
                className={fieldClass}
              />
            </label>
          </div>
          <p className="px-0.5 text-xs text-muted-foreground">
            시각과 수업 시간은 오늘 수업과 같게 채워 두었어요. 바꿔도 돼요.
          </p>

          {error ? (
            <p role="alert" className="rounded-[0.875rem] bg-status-urgent-bg px-3.5 py-2.5 text-xs font-bold text-status-urgent">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!date || pending}
            className="h-13 rounded-full bg-primary text-[0.9375rem] font-extrabold text-white disabled:bg-border disabled:text-muted-foreground"
          >
            {pending
              ? "잡는 중"
              : chosen
                ? `${chosen.month}월 ${chosen.day}일 (${chosen.weekday}) 잡기`
                : date
                  ? `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 잡기`
                  : "날짜를 골라 주세요"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-full text-sm font-semibold text-muted-foreground hover:bg-surface"
          >
            나중에
          </button>
        </form>
      </section>
    </div>
  );
}

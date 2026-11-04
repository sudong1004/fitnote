import Link from "next/link";

import { Check } from "lucide-react";

import type { TrainerStartProgress } from "@/server/trainers/trainer-start-guide.service";
import { cn } from "@/lib/utils";

type Step = {
  key: keyof TrainerStartProgress;
  title: string;
  hint: string;
  href: string;
  action: string;
};

const STEPS: Step[] = [
  {
    key: "hasMember",
    title: "회원 연결하기",
    hint: "초대 코드를 만들어 회원에게 보내거나, 회원을 먼저 등록해요.",
    href: "/trainer/profile",
    action: "초대 코드 만들기",
  },
  {
    key: "hasContract",
    title: "PT 계약 등록하기",
    hint: "회원 상세에서 횟수와 기간을 정해요.",
    href: "/trainer/members",
    action: "회원 고르기",
  },
  {
    key: "hasSession",
    title: "첫 수업 잡기",
    hint: "날짜와 시간을 정하면 회원에게 알림이 가요.",
    href: "/trainer/schedule",
    action: "일정 열기",
  },
  {
    key: "hasJournal",
    title: "알림장 보내기",
    hint: "수업이 끝나면 오늘 한 운동과 한마디를 남겨요.",
    href: "/trainer/journals",
    action: "알림장 열기",
  },
];

/**
 * 처음 쓰는 트레이너를 위한 시작하기 카드.
 * 끝난 단계는 민트 체크, 지금 할 단계 하나만 눈에 띄게 보여 준다.
 * 네 단계가 모두 끝나면 아무것도 그리지 않는다.
 */
export function StartGuide({ progress }: { progress: TrainerStartProgress }) {
  const done = STEPS.filter((step) => progress[step.key]).length;
  if (done === STEPS.length) return null;

  const current = STEPS.findIndex((step) => !progress[step.key]);

  return (
    <section
      aria-label="시작하기"
      className="rounded-3xl border border-border bg-card p-4.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-extrabold tracking-tight">
          시작하기
        </h2>
        <span className="text-xs font-bold text-primary tabular-nums">
          {done}/{STEPS.length} 완료
        </span>
      </div>

      <ol className="mt-3 flex flex-col">
        {STEPS.map((step, index) => {
          const finished = progress[step.key];
          const isCurrent = index === current;

          return (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-3 py-2.5",
                index > 0 && "border-t border-line",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums",
                  finished
                    ? "bg-brand-muted text-primary"
                    : isCurrent
                      ? "bg-ink text-white"
                      : "bg-surface text-muted-foreground",
                )}
              >
                {finished ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    finished && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                  <span className="sr-only">{finished ? " (완료)" : ""}</span>
                </p>

                {isCurrent && (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {step.hint}
                    </p>
                    <Link
                      href={step.href}
                      className="mt-2.5 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-extrabold text-primary-foreground transition-transform active:scale-[0.98]"
                    >
                      {step.action}
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

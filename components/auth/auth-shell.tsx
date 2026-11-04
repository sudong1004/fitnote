import type { ReactNode } from "react";

/**
 * 로그인·가입·비밀번호 화면의 틀.
 *
 * 위는 딥그린 면(브랜드 + 한 줄 문구), 아래는 흰 시트가 살짝 겹쳐 올라온다.
 * 한 화면에 큰 녹색 면은 하나만 쓰는 규칙(README)을 지킨다.
 * 긴 폼(가입)은 `compact` 로 위 면을 낮춘다.
 */
export function AuthShell({
  title,
  subtitle,
  headline,
  compact = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 위 녹색 면에 크게 쓰는 한 줄. compact 이면 쓰지 않는다. */
  headline?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-primary">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header
          className={`relative overflow-hidden px-6 text-white ${
            compact ? "pt-9 pb-12" : "pt-12 pb-16"
          }`}
        >
          {/* 진행 링을 닮은 장식. 글자 뒤에 깔려 있어서 읽는 데 방해되지 않는다. */}
          <svg
            viewBox="0 0 200 200"
            fill="none"
            aria-hidden
            className="pointer-events-none absolute -top-14 -right-12 size-60"
          >
            <circle cx="100" cy="100" r="84" stroke="white" strokeOpacity="0.09" strokeWidth="14" />
            <circle cx="100" cy="100" r="56" stroke="white" strokeOpacity="0.07" strokeWidth="14" />
            <path
              d="M100 16a84 84 0 0 1 79 55"
              stroke="#5fd3a8"
              strokeOpacity="0.9"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>

          <div className="relative flex items-center gap-2.5">
            <span className="flex size-11 items-center justify-center rounded-[0.875rem] bg-white/14 text-brand">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden
                className="size-6"
              >
                <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" />
              </svg>
            </span>
            <span className="leading-tight">
              <b className="block text-lg font-extrabold">FitNote</b>
              <span className="block text-xs text-white/75">나의 운동 알림장</span>
            </span>
          </div>

          {headline && !compact ? (
            <p className="relative mt-9 max-w-[18rem] text-[1.625rem] leading-snug break-keep font-extrabold tracking-tight">
              {headline}
            </p>
          ) : null}
        </header>

        <section className="-mt-7 flex-1 rounded-t-[1.75rem] bg-background px-6 pt-8 pb-10 break-keep">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className={subtitle ? "mt-6" : "mt-6"}>{children}</div>
        </section>
      </div>
    </main>
  );
}

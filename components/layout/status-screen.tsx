import type { ReactNode } from "react";

/**
 * 오류·없는 화면 안내의 틀. 아이콘, 한 줄 제목, 설명, 버튼을 가운데에 쌓는다.
 *
 * 하단 탭이 있는 화면 안에서도, 탭 없이 화면 전체로도 쓴다(`full`).
 * 버튼 모양은 `statusPrimaryAction` / `statusSecondaryAction` 을 쓴다.
 */
export function StatusScreen({
  icon,
  title,
  description,
  full = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  /** 공통 셸 밖(루트)에서 쓸 때. 화면 높이를 다 쓴다. */
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className={`mx-auto flex w-full max-w-md flex-col items-center justify-center px-6 text-center break-keep ${
        full ? "min-h-dvh" : "min-h-[70dvh]"
      }`}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted-foreground [&_svg]:size-6">
        {icon}
      </span>
      <h1 className="mt-5 text-xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-7 flex w-full flex-col gap-2.5">{children}</div>
    </main>
  );
}

export const statusPrimaryAction =
  "flex h-13 items-center justify-center rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground transition-transform active:scale-[0.98]";

export const statusSecondaryAction =
  "flex h-13 items-center justify-center rounded-full bg-surface text-[0.9375rem] font-bold text-ink transition-transform active:scale-[0.98]";

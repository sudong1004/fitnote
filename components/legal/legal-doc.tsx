import Link from "next/link";

import { ChevronLeft } from "lucide-react";

/** 약관·방침 문서의 공통 틀. 로그인 없이도 열린다. */
export function LegalDoc({
  title,
  effective,
  children,
}: {
  title: string;
  effective: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-4 pb-16">
      <Link
        href="/"
        className="inline-flex h-10 items-center gap-1 rounded-full border border-border pr-4 pl-2.5 text-sm font-semibold"
      >
        <ChevronLeft className="size-4" aria-hidden />
        FitNote
      </Link>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">시행일 {effective}</p>
      <div className="mt-6 flex flex-col gap-7 text-[0.9375rem] leading-relaxed text-[#2b3631] [&_h2]:text-[1.0625rem] [&_h2]:font-extrabold [&_h2]:text-foreground [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-bold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

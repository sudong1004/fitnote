import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { isResetTokenUsable } from "@/server/account/password-reset.service";

import { ResetForm } from "./reset-form";

export const metadata = { title: "새 비밀번호 | FitNote" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const usable = typeof token === "string" && (await isResetTokenUsable(token));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <BrandMark />
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">새 비밀번호 정하기</h1>
      {usable ? (
        <ResetForm token={token as string} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-2xl bg-status-urgent-bg px-4 py-3.5 text-sm font-bold text-status-urgent">
            링크가 만료됐거나 이미 쓴 링크예요.
          </p>
          <Link
            href="/forgot-password"
            className="flex h-13 items-center justify-center rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground"
          >
            재설정 메일 다시 받기
          </Link>
        </div>
      )}
    </main>
  );
}

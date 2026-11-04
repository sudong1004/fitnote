import Link from "next/link";

import { TriangleAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      compact
      title="새 비밀번호 정하기"
      subtitle={usable ? "앞으로 쓸 새 비밀번호를 정해 주세요. 바꾸면 다른 기기의 로그인은 풀려요." : undefined}
    >
      {usable ? (
        <ResetForm token={token as string} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-2xl bg-status-urgent-bg px-4 py-3.5 text-sm font-bold text-status-urgent">
            <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
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
    </AuthShell>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { CircleCheck, Lock, Mail } from "lucide-react";

import { login } from "@/app/actions/auth";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";

/** 비밀번호를 바꾸거나 탈퇴한 뒤 돌아왔을 때 한 줄 안내. 주소의 쿼리를 읽으므로 Suspense 안에 둔다. */
function LoginNotice() {
  const params = useSearchParams();
  const notice =
    params.get("reset") === "1"
      ? "비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요."
      : params.get("deleted") === "1"
        ? "탈퇴했어요. 그동안 FitNote를 써 주셔서 고마워요."
        : null;
  if (!notice) return null;
  return (
    <p
      role="status"
      className="mb-5 flex items-start gap-2 rounded-2xl bg-brand-muted px-4 py-3 text-sm font-bold text-primary"
    >
      <CircleCheck className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      {notice}
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <AuthShell
      headline="오늘 운동, 가볍게 남겨요"
      title="다시 만나서 반가워요"
      subtitle="이메일과 비밀번호로 로그인해 주세요."
    >
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>

      <form action={formAction} className="flex flex-col gap-4">
        <AuthField
          id="email"
          name="email"
          label="이메일"
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder="fitnote@example.com"
          errors={state?.errors?.email}
        />
        <AuthField
          id="password"
          name="password"
          label="비밀번호"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          errors={state?.errors?.password}
        />

        {state?.message && <p className="mx-1 text-sm text-destructive">{state.message}</p>}

        <SubmitButton pending={pending} idle="로그인" busy="로그인 중..." />
      </form>

      <p className="mt-5 text-center text-sm">
        <Link href="/forgot-password" className="font-semibold text-muted-foreground underline underline-offset-4">
          비밀번호를 잊으셨나요?
        </Link>
      </p>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-bold text-primary underline underline-offset-4">
          회원가입
        </Link>
      </div>
    </AuthShell>
  );
}

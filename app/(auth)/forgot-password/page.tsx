"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/actions/password-reset";
import { BrandMark } from "@/components/layout/brand-mark";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <BrandMark />
      <h1 className="text-2xl font-extrabold tracking-tight">비밀번호 찾기</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        가입한 이메일을 적으면 새 비밀번호를 정하는 링크를 보내 드려요.
      </p>

      {state?.ok ? (
        <p role="status" className="rounded-2xl bg-brand-muted px-4 py-3.5 text-sm leading-relaxed text-primary">
          {state.message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="mx-1 text-[0.8125rem] font-bold">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="fitnote@example.com"
              className="h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary"
            />
            {state?.errors?.email ? <p className="text-sm text-destructive">{state.errors.email[0]}</p> : null}
          </div>
          {state?.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 h-13 rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "보내는 중..." : "재설정 링크 받기"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-bold text-primary underline underline-offset-4">
          로그인으로 돌아가기
        </Link>
      </p>
    </main>
  );
}

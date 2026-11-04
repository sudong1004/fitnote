"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Info, Mail, MailCheck } from "lucide-react";

import { requestPasswordReset } from "@/app/actions/password-reset";
import { useSubmitKeep } from "@/app/lib/use-submit-keep";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";

function ForgotForm({ onRetry }: { onRetry: () => void }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const onSubmit = useSubmitKeep(action);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-[1.375rem] bg-brand-muted px-5 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-white text-primary">
            <MailCheck className="size-7" aria-hidden />
          </span>
          <p role="status" className="text-sm leading-relaxed font-bold text-primary">
            {state.message}
          </p>
        </div>

        <div className="flex gap-2.5 rounded-2xl bg-surface px-4 py-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>
            메일이 보이지 않으면 <b className="text-foreground">스팸함</b>(또는 프로모션함)을 확인해 주세요. 처음
            받는 메일은 스팸으로 분류될 수 있어요. 스팸함에서 찾으면 &lsquo;스팸 아님&rsquo;을 눌러 주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="h-12 rounded-full border border-border text-sm font-bold text-ink hover:bg-surface"
        >
          메일이 안 왔어요. 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
      {state?.message ? <p className="mx-1 text-sm text-destructive">{state.message}</p> : null}
      <SubmitButton pending={pending} idle="재설정 링크 받기" busy="보내는 중..." />
      <p className="mx-1 text-xs leading-relaxed text-muted-foreground">
        메일이 스팸함으로 갈 수 있어요. 안 보이면 스팸함도 확인해 주세요.
      </p>
    </form>
  );
}

export default function ForgotPasswordPage() {
  // 다시 보내기를 누르면 폼을 새로 만들어 입력과 결과를 비운다.
  const [attempt, setAttempt] = useState(0);

  return (
    <AuthShell
      compact
      title="비밀번호 찾기"
      subtitle="가입한 이메일을 적으면 새 비밀번호를 정하는 링크를 보내 드려요."
    >
      <ForgotForm key={attempt} onRetry={() => setAttempt((value) => value + 1)} />

      <div className="mt-8 border-t border-border pt-6 text-center text-sm">
        <Link href="/login" className="font-bold text-primary underline underline-offset-4">
          로그인으로 돌아가기
        </Link>
      </div>
    </AuthShell>
  );
}

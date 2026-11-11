"use client";

import { useActionState } from "react";

import { resendVerification, verifyEmail } from "@/app/actions/email-verification";
import { SubmitButton } from "@/components/auth/submit-button";

/** 메일의 링크를 열었을 때 인증을 끝내는 버튼. */
export function ConfirmForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmail, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state?.message ? <p className="mx-1 text-sm text-destructive">{state.message}</p> : null}
      <SubmitButton pending={pending} idle="이메일 인증 끝내기" busy="인증하는 중..." />
    </form>
  );
}

/** 인증 메일 다시 보내기. */
export function ResendForm() {
  const [state, action, pending] = useActionState(resendVerification, undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full border border-border text-sm font-bold text-ink hover:bg-surface disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "메일이 안 왔어요. 다시 보내기"}
      </button>
      {state?.message ? (
        <p
          role="status"
          className={`mx-1 text-center text-sm ${state.ok ? "font-bold text-primary" : "text-destructive"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

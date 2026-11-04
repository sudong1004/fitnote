"use client";

import { useActionState } from "react";

import { Lock } from "lucide-react";

import { resetPassword } from "@/app/actions/password-reset";
import { AuthField } from "@/components/auth/auth-field";
import { SubmitButton } from "@/components/auth/submit-button";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <AuthField
        id="newPassword"
        name="newPassword"
        label="새 비밀번호"
        hint="영문·숫자 포함 8자 이상"
        type="password"
        icon={Lock}
        autoComplete="new-password"
        errors={errors.newPassword}
      />
      <AuthField
        id="confirmPassword"
        name="confirmPassword"
        label="새 비밀번호 확인"
        type="password"
        icon={Lock}
        autoComplete="new-password"
        errors={errors.confirmPassword}
      />
      {state?.message ? <p className="mx-1 text-sm text-destructive">{state.message}</p> : null}
      <SubmitButton pending={pending} idle="비밀번호 바꾸기" busy="바꾸는 중..." />
    </form>
  );
}

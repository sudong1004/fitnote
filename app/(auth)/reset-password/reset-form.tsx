"use client";

import { useActionState } from "react";

import { resetPassword } from "@/app/actions/password-reset";

const inputClass =
  "h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="mx-1 text-[0.8125rem] font-bold">
          새 비밀번호 <span className="font-normal text-muted-foreground">영문·숫자 포함 8자 이상</span>
        </label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className={inputClass} />
        {errors.newPassword ? <p className="text-sm text-destructive">{errors.newPassword[0]}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="mx-1 text-[0.8125rem] font-bold">
          새 비밀번호 확인
        </label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={inputClass} />
        {errors.confirmPassword ? <p className="text-sm text-destructive">{errors.confirmPassword[0]}</p> : null}
      </div>
      {state?.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-13 rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "바꾸는 중..." : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}

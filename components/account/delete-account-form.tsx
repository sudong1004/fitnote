"use client";

import { useActionState } from "react";

import { deleteAccount } from "@/app/actions/delete-account";

const inputClass =
  "h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary";

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4 rounded-[1.375rem] border border-border bg-card p-4.5">
      {hasPassword ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="mx-1 text-[0.8125rem] font-bold">
            비밀번호
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" className={inputClass} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password[0]}</p> : null}
        </div>
      ) : null}

      <label className="flex items-start gap-2.5 text-sm leading-relaxed">
        <input type="checkbox" name="confirm" className="mt-1 size-4.5 shrink-0 accent-[var(--color-coral)]" />
        <span>위 안내를 읽었고, 지운 기록은 되살릴 수 없다는 것을 알고 있어요.</span>
      </label>
      {errors.confirm ? <p className="-mt-2 text-sm text-destructive">{errors.confirm[0]}</p> : null}

      {state?.message ? <p className="text-sm text-destructive">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-destructive text-[0.9375rem] font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "탈퇴하는 중..." : "탈퇴하기"}
      </button>
    </form>
  );
}

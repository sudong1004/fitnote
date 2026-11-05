"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Dumbbell, Lock, Mail, User, UserRound } from "lucide-react";

import { signup } from "@/app/actions/auth";
import { useSubmitKeep } from "@/app/lib/use-submit-keep";
import { AuthField } from "@/components/auth/auth-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { ConsentFields } from "@/components/legal/consent-fields";

const ROLES = [
  { value: "MEMBER", label: "회원", hint: "운동을 기록해요", icon: Dumbbell },
  { value: "TRAINER", label: "트레이너", hint: "회원을 관리해요", icon: UserRound },
] as const;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const onSubmit = useSubmitKeep(formAction);

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mx-1 mb-1.5 text-[0.8125rem] font-bold">가입 유형</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  defaultChecked={(state?.values?.role ?? "MEMBER") === option.value}
                  className="peer sr-only"
                />
                <span className="flex h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] border-border bg-surface/60 text-sm font-bold text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-brand-muted peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <option.icon className="size-5" aria-hidden />
                  {option.label}
                  <span className="text-xs font-normal opacity-80">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <AuthField
          id="name"
          name="name"
          label="이름"
          icon={User}
          autoComplete="name"
          defaultValue={state?.values?.name}
          placeholder="홍길동"
          errors={state?.errors?.name}
        />
        <AuthField
          id="email"
          name="email"
          label="이메일"
          type="email"
          icon={Mail}
          autoComplete="email"
          defaultValue={state?.values?.email}
          placeholder="fitnote@example.com"
          errors={state?.errors?.email}
        />
        <AuthField
          id="password"
          name="password"
          label="비밀번호"
          hint="영문·숫자 포함 8자 이상"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          errors={state?.errors?.password}
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          label="비밀번호 확인"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          errors={state?.errors?.confirmPassword}
        />

        {state?.message && <p className="mx-1 text-sm text-destructive">{state.message}</p>}

        <ConsentFields error={state?.errors?.consent?.[0]} />

        <SubmitButton pending={pending} idle="가입하기" busy="가입 중..." />
      </form>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-primary underline underline-offset-4">
          로그인
        </Link>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Lock, Mail } from "lucide-react";

import { claimAccount } from "@/app/actions/auth";
import { useSubmitKeep } from "@/app/lib/use-submit-keep";
import { AuthField } from "@/components/auth/auth-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { ConsentFields } from "@/components/legal/consent-fields";

/**
 * 트레이너가 만들어 둔 계정을 이어받는 폼. 제목(누구의 계정인지)은 위 틀에 있다.
 *
 * 맨 위에 누구의 계정을 가져가는지 먼저 적는다. 이 확인 없이 비밀번호부터
 * 정하게 하면, 잘못 전달된 링크로 남의 기록을 가져가고도 아무도 모른다.
 *
 * 이름 칸이 없다. 이름은 트레이너가 이미 적어 뒀고 그 이름으로 수업과
 * 알림장이 쌓여 있다. 여기서 다시 물으면 트레이너의 목록에서 사람이 바뀐
 * 것처럼 보인다.
 */
export function ClaimForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(claimAccount, undefined);
  const onSubmit = useSubmitKeep(formAction);

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={code} />

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

        {state?.message && <p className="mx-1 text-sm text-destructive">{state.message}</p>}

        <ConsentFields error={state?.errors?.consent?.[0]} />

        <SubmitButton pending={pending} idle="시작하기" busy="시작하는 중..." />
      </form>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        내가 아닌가요?{" "}
        <Link href="/signup" className="font-bold text-primary underline underline-offset-4">
          새로 가입하기
        </Link>
      </div>
    </>
  );
}

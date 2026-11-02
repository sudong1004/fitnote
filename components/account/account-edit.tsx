"use client";

import { useActionState, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { savePassword, saveProfile } from "@/app/actions/account";
import type { AccountFormState } from "@/app/lib/definitions";
import { cn } from "@/lib/utils";

const inputClass =
  "h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-4 text-[0.9375rem] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-ring/30";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-[0.8125rem] font-bold">
        {label}
        {hint ? <span className="ml-1 font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
      {error?.[0] ? <span className="px-1 text-xs font-medium text-destructive">{error[0]}</span> : null}
    </label>
  );
}

function Result({ state }: { state: AccountFormState }) {
  if (!state?.message) return null;
  return (
    <p
      role="status"
      className={cn("px-1 text-sm font-medium", state.ok ? "text-primary" : "text-destructive")}
    >
      {state.message}
    </p>
  );
}

export type AccountDefaults = {
  name: string;
  email: string | null;
  phone: string | null;
  trainer: {
    displayName: string | null;
    specialty: string | null;
    careerYears: number | null;
    bio: string | null;
  } | null;
};

/** 이름·전화번호(+ 트레이너 소개) 수정. */
export function ProfileForm({ defaults }: { defaults: AccountDefaults }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4 rounded-[1.375rem] border border-border p-4">
      <b className="text-[0.9375rem]">기본 정보</b>

      <Field label="이메일" hint="로그인 아이디라 바꿀 수 없어요">
        <input value={defaults.email ?? ""} readOnly disabled className={cn(inputClass, "bg-surface text-muted-foreground")} />
      </Field>

      <Field label="이름" error={errors.name}>
        <input name="name" defaultValue={defaults.name} required minLength={2} maxLength={20} autoComplete="name" className={inputClass} />
      </Field>

      <Field label="전화번호" hint="(선택)" error={errors.phone}>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={defaults.phone ?? ""}
          placeholder="010-1234-5678"
          maxLength={20}
          autoComplete="tel"
          className={inputClass}
        />
      </Field>

      {defaults.trainer ? (
        <>
          <b className="mt-1 text-[0.9375rem]">회원에게 보이는 소개</b>

          <Field label="활동 이름" hint="(비우면 이름으로 보여요)" error={errors.displayName}>
            <input
              name="displayName"
              defaultValue={defaults.trainer.displayName ?? ""}
              placeholder={defaults.name}
              maxLength={20}
              className={inputClass}
            />
          </Field>

          <Field label="전문 분야" hint="쉼표로 구분" error={errors.specialty}>
            <input
              name="specialty"
              defaultValue={defaults.trainer.specialty ?? ""}
              placeholder="다이어트, 체형 교정, 재활"
              maxLength={60}
              className={inputClass}
            />
          </Field>

          <Field label="경력" hint="(년)" error={errors.careerYears}>
            <input
              name="careerYears"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              defaultValue={defaults.trainer.careerYears ?? ""}
              placeholder="5"
              className={inputClass}
            />
          </Field>

          <Field label="소개" error={errors.bio}>
            <textarea
              name="bio"
              defaultValue={defaults.trainer.bio ?? ""}
              placeholder="회원에게 하고 싶은 말, 수업 스타일 등"
              maxLength={500}
              rows={4}
              className={cn(inputClass, "h-auto resize-none py-3 leading-relaxed")}
            />
          </Field>
        </>
      ) : null}

      <Result state={state} />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-primary text-[0.9375rem] font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "저장 중" : "저장"}
      </button>
    </form>
  );
}

function PasswordInput({ name, autoComplete }: { name: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative flex">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className={cn(inputClass, "pr-12")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
      </button>
    </span>
  );
}

/** 비밀번호 변경. 저장되면 칸을 비운다. */
export function PasswordForm() {
  const [state, action, pending] = useActionState(savePassword, undefined);
  const errors = state?.errors ?? {};

  return (
    <form
      action={action}
      // 성공하면 폼을 새로 그려서 입력한 비밀번호가 화면에 남지 않게 한다.
      key={state?.ok ? "done" : "editing"}
      className="flex flex-col gap-4 rounded-[1.375rem] border border-border p-4"
    >
      <b className="text-[0.9375rem]">비밀번호 변경</b>

      <Field label="지금 비밀번호" error={errors.currentPassword}>
        <PasswordInput name="currentPassword" autoComplete="current-password" />
      </Field>
      <Field label="새 비밀번호" hint="영문·숫자 포함 8자 이상" error={errors.newPassword}>
        <PasswordInput name="newPassword" autoComplete="new-password" />
      </Field>
      <Field label="새 비밀번호 확인" error={errors.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" />
      </Field>

      <Result state={state} />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-ink text-[0.9375rem] font-bold text-white disabled:opacity-50"
      >
        {pending ? "바꾸는 중" : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}

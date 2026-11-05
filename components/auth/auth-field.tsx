"use client";

import { useState } from "react";

import { Eye, EyeOff, type LucideIcon } from "lucide-react";

/**
 * 로그인·가입 화면의 입력칸. 왼쪽에 아이콘을 두고, 비밀번호는 보기/숨기기 버튼을 단다.
 * 입력값은 비제어로 두어서 form action 이 그대로 읽는다.
 */
export function AuthField({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  autoComplete,
  hint,
  defaultValue,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  icon: LucideIcon;
  type?: "text" | "email" | "password" | "tel";
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  /** 실패 뒤 다시 채울 값. */
  defaultValue?: string;
  errors?: string[];
}) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const hasError = !!errors?.length;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="mx-1 flex items-baseline gap-1.5 text-[0.8125rem] font-bold">
        {label}
        {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </label>
      <div className="group relative">
        <Icon
          className={`pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 transition-colors ${
            hasError ? "text-destructive" : "text-faint group-focus-within:text-primary"
          }`}
          aria-hidden
        />
        <input
          id={id}
          name={name}
          defaultValue={defaultValue}
          type={isPassword && shown ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={type === "text" ? undefined : "none"}
          autoCorrect={type === "text" ? undefined : "off"}
          spellCheck={type === "text" ? undefined : false}
          inputMode={type === "email" ? "email" : undefined}
          aria-invalid={hasError || undefined}
          className={`h-13 w-full rounded-2xl border bg-surface/60 pl-11 text-[0.9375rem] outline-none placeholder:text-faint focus:bg-card focus:border-[1.5px] focus:border-primary ${
            isPassword ? "pr-12" : "pr-4"
          } ${hasError ? "border-coral" : "border-border"}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShown((value) => !value)}
            aria-label={shown ? "비밀번호 숨기기" : "비밀번호 보기"}
            className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-foreground"
          >
            {shown ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
          </button>
        ) : null}
      </div>
      {hasError ? (
        <ul className="mx-1 text-sm text-destructive">
          {errors!.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

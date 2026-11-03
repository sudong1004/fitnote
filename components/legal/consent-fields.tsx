"use client";

import Link from "next/link";
import { useState } from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { name: "agreeAge", label: "만 14세 이상이에요", href: null },
  { name: "agreeTerms", label: "이용약관 동의", href: "/terms" },
  { name: "agreePrivacy", label: "개인정보 수집·이용 동의", href: "/privacy" },
  {
    name: "agreeSensitive",
    label: "건강 관련 정보(운동·식단·체성분) 처리 동의",
    href: "/privacy#sensitive",
  },
] as const;

type Name = (typeof ITEMS)[number]["name"];

function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
        checked ? "border-primary bg-primary text-white" : "border-input bg-card text-transparent",
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/**
 * 가입 동의. 전부 필수다.
 *
 * 건강 관련 정보(운동·식단 사진·체중)는 개인정보보호법의 민감정보라서 일반 수집 동의와
 * 따로 받는다. 만 14세 미만은 법정대리인 동의가 필요해서 받지 않는다.
 */
export function ConsentFields({ error }: { error?: string }) {
  const [checked, setChecked] = useState<Record<Name, boolean>>({
    agreeAge: false,
    agreeTerms: false,
    agreePrivacy: false,
    agreeSensitive: false,
  });
  const all = ITEMS.every((item) => checked[item.name]);

  return (
    <fieldset className="flex flex-col gap-1 rounded-2xl border border-border p-3.5">
      <legend className="sr-only">약관 동의</legend>
      <label className="flex cursor-pointer items-center gap-2.5 pb-2.5">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={all}
          onChange={(event) =>
            setChecked({
              agreeAge: event.target.checked,
              agreeTerms: event.target.checked,
              agreePrivacy: event.target.checked,
              agreeSensitive: event.target.checked,
            })
          }
        />
        <Box checked={all} />
        <b className="text-[0.9375rem]">전체 동의</b>
      </label>
      <div className="flex flex-col gap-2 border-t border-line pt-2.5">
        {ITEMS.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name={item.name}
                className="peer sr-only"
                checked={checked[item.name]}
                onChange={(event) =>
                  setChecked((prev) => ({ ...prev, [item.name]: event.target.checked }))
                }
              />
              <Box checked={checked[item.name]} />
              <span className="min-w-0 text-[0.8125rem]">
                <span className="font-bold text-primary">(필수)</span> {item.label}
              </span>
            </label>
            {item.href ? (
              <Link
                href={item.href}
                target="_blank"
                className="shrink-0 text-xs font-semibold text-muted-foreground underline underline-offset-2"
              >
                보기
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="pt-1.5 text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}

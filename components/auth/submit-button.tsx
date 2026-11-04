import { ArrowRight } from "lucide-react";

/** 인증 화면의 주 버튼. 진행 중이면 글자를 바꾸고 비활성화한다. */
export function SubmitButton({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 flex h-13 items-center justify-center gap-1.5 rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? busy : idle}
      {pending ? null : <ArrowRight className="size-4.5" aria-hidden />}
    </button>
  );
}

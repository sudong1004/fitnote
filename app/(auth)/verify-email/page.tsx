import Link from "next/link";

import { CircleCheck, Info, MailCheck, TriangleAlert } from "lucide-react";

import { readPendingEmail } from "@/app/lib/verification-mail";
import { AuthShell } from "@/components/auth/auth-shell";
import { getVerificationTokenState } from "@/server/account/email-verification.service";

import { ConfirmForm, ResendForm } from "./verify-forms";

export const metadata = { title: "이메일 인증 | FitNote" };

const primaryLink =
  "flex h-13 items-center justify-center rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground";

/**
 * 이메일 인증 화면. 두 가지로 쓰인다.
 *
 * - 가입 직후(주소에 token 없음): "메일을 확인해 주세요" 안내와 다시 보내기
 * - 메일의 링크를 열었을 때(token 있음): 인증을 끝내는 버튼
 *
 * 링크를 여는 것만으로는 인증하지 않는다. 메일 보안 프로그램이 링크를 미리 열어 보는
 * 경우가 있어서, 사람이 버튼을 눌러야 끝난다.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  if (typeof token === "string") {
    const state = await getVerificationTokenState(token);

    return (
      <AuthShell
        compact
        title="이메일 인증"
        subtitle={state === "usable" ? "아래 버튼을 누르면 가입이 끝나요." : undefined}
      >
        {state === "usable" ? (
          <ConfirmForm token={token} />
        ) : state === "done" ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="flex items-start gap-2 rounded-2xl bg-brand-muted px-4 py-3.5 text-sm font-bold text-primary"
            >
              <CircleCheck className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              이미 인증이 끝난 이메일이에요. 로그인해 주세요.
            </p>
            <Link href="/login" className={primaryLink}>
              로그인하기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-2xl bg-status-urgent-bg px-4 py-3.5 text-sm font-bold text-status-urgent">
              <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              링크가 만료됐거나 새 링크가 나간 뒤예요.
            </p>
            <p className="mx-1 text-sm leading-relaxed text-muted-foreground">
              가입할 때 적은 이메일과 비밀번호로 로그인하면 인증 메일을 다시 보내 드려요.
            </p>
            <Link href="/login" className={primaryLink}>
              로그인하고 다시 받기
            </Link>
          </div>
        )}
      </AuthShell>
    );
  }

  const email = await readPendingEmail();

  return (
    <AuthShell compact title="메일을 확인해 주세요" subtitle="메일의 버튼을 눌러야 가입이 끝나요.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-[1.375rem] bg-brand-muted px-5 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-white text-primary">
            <MailCheck className="size-7" aria-hidden />
          </span>
          <p role="status" className="text-sm leading-relaxed font-bold text-primary">
            {email ? (
              <>
                <span className="break-all">{email}</span>
                <br />
                주소로 메일을 보냈어요.
              </>
            ) : (
              "가입할 때 적은 주소로 메일을 보냈어요."
            )}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-primary/80">
            메일을 열어 안내를 따라 주세요. 인증 링크는 24시간 동안 쓸 수 있어요.
          </p>
        </div>

        <div className="flex gap-2.5 rounded-2xl bg-surface px-4 py-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>
            메일이 보이지 않으면 <b className="text-foreground">스팸함</b>(또는 프로모션함)을 확인해 주세요.
            주소를 잘못 적었다면 가입을 다시 해 주세요. 트레이너에게 받은 링크로 시작했다면 그 링크를 다시 열면 돼요.
          </p>
        </div>

        {email ? <ResendForm /> : null}

        <Link href="/login" className={primaryLink}>
          인증했어요. 로그인하기
        </Link>
      </div>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        주소를 잘못 적었나요?{" "}
        <Link href="/signup" className="font-bold text-primary underline underline-offset-4">
          다시 가입하기
        </Link>
      </div>
    </AuthShell>
  );
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  type AccountFormState,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "@/app/lib/definitions";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  attemptKey,
  getClientIp,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { renderMail } from "@/lib/mail-template";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/server/account/password-reset.service";

const FAILED_MESSAGE =
  "지금 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요. 계속 안 되면 문의 이메일로 알려 주세요.";

const SENT_MESSAGE =
  "가입된 이메일이면 비밀번호 재설정 링크를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요. 링크는 30분 동안 쓸 수 있어요.";

async function appOrigin() {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // 운영에서는 요청의 Host 헤더로 링크를 만들지 않는다. APP_URL 을 빠뜨려도 Vercel 이
  // 알려 주는 운영 주소를 쓴다.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && production) return `https://${production}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 재설정 링크 보내기. 가입 여부와 상관없이 같은 안내를 돌려준다. */
export async function requestPasswordReset(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { email } = parsed.data;
  const ip = await getClientIp();
  const ipKey = attemptKey("reset", ip);
  const accountKey = attemptKey("reset", ip, email);

  if (
    (await isRateLimited(ipKey, AUTH_LIMITS.resetIp)) ||
    (await isRateLimited(accountKey, AUTH_LIMITS.resetAccount))
  ) {
    return { message: RATE_LIMIT_MESSAGE };
  }
  await Promise.all([recordAttempt(ipKey), recordAttempt(accountKey)]);

  const issued = await createPasswordResetToken(email);
  if (issued) {
    const link = `${await appOrigin()}/reset-password?token=${issued.token}`;
    const sent = await sendMail({
      to: email,
      subject: "FitNote 비밀번호 재설정 안내",
      text: `${issued.name}님, 안녕하세요.\n\n비밀번호를 다시 정하려면 아래 주소를 열어 주세요. 링크는 30분 동안, 한 번만 쓸 수 있어요.\n\n${link}\n\n비밀번호 재설정을 요청하지 않았다면 이 메일은 무시하셔도 돼요. 비밀번호는 바뀌지 않아요.\n\n- FitNote`,
      html: renderMail({
        preheader: "30분 안에 새 비밀번호를 정해 주세요.",
        title: "새 비밀번호를 정해 주세요",
        paragraphs: [
          `${issued.name}님, 안녕하세요.`,
          "아래 버튼을 눌러 새 비밀번호를 정할 수 있어요. 링크는 30분 동안, 한 번만 쓸 수 있어요.",
        ],
        button: { label: "새 비밀번호 정하기", url: link },
        note: "비밀번호 재설정을 요청하지 않았다면 이 메일은 무시하셔도 돼요. 비밀번호는 바뀌지 않아요.",
      }),
    });
    // 가입 여부는 숨기되, 실제로 보내지 못한 서버 문제는 알려 준다.
    if (!sent) return { message: FAILED_MESSAGE };
  }

  return { ok: true, message: SENT_MESSAGE };
}

export async function resetPassword(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = ResetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.newPassword);
  if (result === "invalid") {
    return { message: "링크가 만료됐거나 이미 쓴 링크예요. 재설정 메일을 다시 받아 주세요." };
  }

  redirect("/login?reset=1");
}

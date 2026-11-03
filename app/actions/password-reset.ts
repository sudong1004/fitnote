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
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/server/account/password-reset.service";

const SENT_MESSAGE =
  "가입된 이메일이면 비밀번호 재설정 링크를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요. 링크는 30분 동안 쓸 수 있어요.";

async function appOrigin() {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
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
    await sendMail({
      to: email,
      subject: "[FitNote] 비밀번호 재설정 링크",
      text: `${issued.name}님, 아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.\n\n${link}\n\n요청하지 않았다면 이 메일은 무시하셔도 돼요. 비밀번호는 바뀌지 않아요.`,
      html: `<p>${issued.name}님, 아래 버튼을 눌러 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#2f6b53;color:#fff;text-decoration:none;font-weight:700">새 비밀번호 정하기</a></p><p style="color:#5f6a64;font-size:13px">요청하지 않았다면 이 메일은 무시하셔도 돼요. 비밀번호는 바뀌지 않아요.</p>`,
    });
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

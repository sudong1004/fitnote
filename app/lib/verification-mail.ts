import "server-only";

import { cookies } from "next/headers";

import { appOrigin } from "@/app/lib/app-origin";
import { AUTH_LIMITS, attemptKey, isRateLimited, recordAttempt } from "@/app/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { renderMail } from "@/lib/mail-template";
import { createEmailVerificationToken } from "@/server/account/email-verification.service";

/**
 * 인증을 기다리는 주소를 "메일을 확인해 주세요" 화면에 넘기는 쿠키.
 * 주소를 화면 주소(쿼리)에 실으면 서버 기록에 이메일이 남아서 쿠키로 넘긴다.
 */
const PENDING_EMAIL_COOKIE = "fitnote_verify_email";
const PENDING_EMAIL_MAX_AGE = 24 * 60 * 60;

export async function rememberPendingEmail(email: string) {
  const cookieStore = await cookies();

  cookieStore.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PENDING_EMAIL_MAX_AGE,
    path: "/",
  });
}

export async function readPendingEmail() {
  const value = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? "";

  return value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value) ? value : null;
}

export async function forgetPendingEmail() {
  (await cookies()).delete(PENDING_EMAIL_COOKIE);
}

/**
 * 한 주소로 나가는 가입 관련 메일 수를 센다. 한도를 넘으면 보내지 않지만 보낸 것처럼
 * 답한다(true). 화면은 어느 경우든 같아야 하고, 넘은 쪽은 이미 받은 메일이 있다.
 */
async function withinAddressLimit(email: string) {
  const key = attemptKey("signup-mail", "any", email);

  if (await isRateLimited(key, AUTH_LIMITS.signupMailAddress)) return false;

  await recordAttempt(key);
  return true;
}

/** 인증 메일을 보낸다. 인증할 것이 없는 계정이면 아무것도 하지 않는다. */
export async function sendVerificationMail(userId: string, email: string) {
  if (!(await withinAddressLimit(email))) return true;

  const issued = await createEmailVerificationToken(userId);
  if (!issued) return true;

  const link = `${await appOrigin()}/verify-email?token=${issued.token}`;

  return sendMail({
    to: issued.email,
    subject: "FitNote 이메일 인증 안내",
    text: `${issued.name}님, 안녕하세요.\n\nFitNote 가입을 끝내려면 아래 주소를 열어 이메일을 인증해 주세요. 링크는 24시간 동안 쓸 수 있어요.\n\n${link}\n\n가입한 적이 없다면 이 메일은 무시하셔도 돼요. 인증하지 않으면 계정은 쓸 수 없어요.\n\n- FitNote`,
    html: renderMail({
      preheader: "버튼을 누르면 가입이 끝나요.",
      title: "이메일을 인증해 주세요",
      paragraphs: [
        `${issued.name}님, 안녕하세요.`,
        "아래 버튼을 눌러 이메일을 인증하면 가입이 끝나요. 링크는 24시간 동안 쓸 수 있어요.",
      ],
      button: { label: "이메일 인증하기", url: link },
      note: "가입한 적이 없다면 이 메일은 무시하셔도 돼요. 인증하지 않으면 계정은 쓸 수 없어요.",
    }),
  });
}

/**
 * 이미 가입된 주소로 누군가 다시 가입하려 했을 때 그 주소의 주인에게 보내는 안내.
 * 가입 화면은 이 경우에도 "메일을 확인해 주세요" 만 보여 준다.
 */
export async function sendAlreadyRegisteredMail(email: string) {
  if (!(await withinAddressLimit(email))) return true;

  const origin = await appOrigin();
  const loginLink = `${origin}/login`;

  return sendMail({
    to: email,
    subject: "FitNote 가입 안내",
    text: `안녕하세요.\n\n이 이메일로 FitNote 가입 요청이 있었어요. 이 주소로는 이미 가입돼 있어서 새 계정은 만들지 않았어요.\n\n로그인: ${loginLink}\n비밀번호를 잊었다면: ${origin}/forgot-password\n\n가입을 요청한 적이 없다면 이 메일은 무시하셔도 돼요. 계정은 그대로예요.\n\n- FitNote`,
    html: renderMail({
      preheader: "이 주소로는 이미 가입돼 있어요.",
      title: "이미 가입된 이메일이에요",
      paragraphs: [
        "이 이메일로 FitNote 가입 요청이 있었어요. 이 주소로는 이미 가입돼 있어서 새 계정은 만들지 않았어요.",
        "아래 버튼으로 로그인해 주세요. 비밀번호를 잊었다면 로그인 화면의 '비밀번호를 잊으셨나요?'에서 다시 정할 수 있어요.",
      ],
      button: { label: "로그인하기", url: loginLink },
      note: "가입을 요청한 적이 없다면 이 메일은 무시하셔도 돼요. 계정은 그대로예요.",
    }),
  });
}

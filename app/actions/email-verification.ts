"use server";

import { redirect } from "next/navigation";

import type { AccountFormState } from "@/app/lib/definitions";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  attemptKey,
  getClientIp,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";
import {
  forgetPendingEmail,
  readPendingEmail,
  sendVerificationMail,
} from "@/app/lib/verification-mail";
import { prisma } from "@/lib/prisma";
import { verifyEmailWithToken } from "@/server/account/email-verification.service";

/**
 * 인증 메일 다시 보내기. 주소는 가입할 때 심은 쿠키에서 읽는다.
 * 그 주소로 인증을 기다리는 계정이 없어도 같은 안내를 돌려준다.
 */
export async function resendVerification(): Promise<AccountFormState> {
  const email = await readPendingEmail();

  if (!email) {
    return { message: "어느 주소인지 알 수 없어요. 로그인하면 인증 메일을 다시 보내 드려요." };
  }

  const ipKey = attemptKey("verify", await getClientIp());

  if (await isRateLimited(ipKey, AUTH_LIMITS.verifyIp)) {
    return { message: RATE_LIMIT_MESSAGE };
  }
  await recordAttempt(ipKey);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user && !(await sendVerificationMail(user.id, email))) {
    return { message: "지금 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, message: "인증 메일을 다시 보냈어요. 가장 최근에 받은 메일의 버튼을 눌러 주세요." };
}

/** 메일의 링크를 열고 버튼을 눌렀을 때. 인증을 끝내고 로그인 화면으로 보낸다. */
export async function verifyEmail(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const token = String(formData.get("token") ?? "");

  if (token.length < 20 || (await verifyEmailWithToken(token)) === "invalid") {
    return { message: "링크가 만료됐거나 새 링크가 나간 뒤예요. 로그인하면 인증 메일을 다시 보내 드려요." };
  }

  await forgetPendingEmail();

  redirect("/login?verified=1");
}

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import {
  type AuthFormState,
  ClaimFormSchema,
  LoginFormSchema,
  SignupFormSchema,
} from "@/app/lib/definitions";

import {
  ConnectionError,
  claimMemberAccount,
} from "@/server/trainers/connection.service";

import { registerAccount } from "@/server/account/email-verification.service";

import { TERMS_VERSION, hasAllConsents } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  attemptKey,
  clearAttempts,
  getClientIp,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";
import { createSession, deleteSession } from "@/app/lib/session";
import {
  rememberPendingEmail,
  sendAlreadyRegisteredMail,
  sendVerificationMail,
} from "@/app/lib/verification-mail";

const SALT_ROUNDS = 10;

/**
 * 없는 계정에도 같은 시간만큼 bcrypt 를 돌리기 위한 값.
 * 이게 없으면 없는 이메일이 눈에 띄게 빨리 돌아와 응답 시간으로 계정이 드러난다.
 */
const DUMMY_HASH =
  "$2b$10$kLb.J.yOyj1k9CAE8neuN.Giho6zF0SBQo5Al70SWGVLMLfWbPUoC";

const MAIL_FAILED_MESSAGE =
  "지금 인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요. 계속 안 되면 문의 이메일로 알려 주세요.";

/**
 * 가입·이어받기·인증 전 로그인이 모두 여기로 끝난다: 메일을 보내고 "메일을 확인해
 * 주세요" 화면으로 보낸다. 이미 가입된 주소였어도 화면은 같고, 그 주소로는 안내 메일이 간다.
 * 그래서 가입 화면으로는 어떤 주소가 가입돼 있는지 알 수 없다.
 */
async function finishWithMail(
  email: string,
  userId: string | null,
): Promise<AuthFormState> {
  const sent = userId
    ? await sendVerificationMail(userId, email)
    : await sendAlreadyRegisteredMail(email);

  if (!sent) return { message: MAIL_FAILED_MESSAGE };

  await rememberPendingEmail(email);

  redirect("/verify-email");
}

async function signupImpl(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = validated.data;

  if (!hasAllConsents(formData)) {
    return { errors: { consent: ["필수 항목에 모두 동의해 주세요."] } };
  }

  // 역할은 가입할 때 정하고 하나만 가진다. 값이 이상하면 회원으로 본다.
  const isTrainer = formData.get("role") === "TRAINER";

  const ip = await getClientIp();
  const signupKey = attemptKey("signup", ip);

  if (await isRateLimited(signupKey, AUTH_LIMITS.signupIp)) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  await recordAttempt(signupKey);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await registerAccount({
    name,
    email,
    passwordHash,
    isTrainer,
    termsVersion: TERMS_VERSION,
  });

  return finishWithMail(email, result.status === "created" ? result.userId : null);
}

async function claimAccountImpl(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = ClaimFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const code = String(formData.get("code") ?? "");

  if (!code) {
    return {
      message: "이어받기 코드가 없어요.",
    };
  }

  const { email, password } = validated.data;

  if (!hasAllConsents(formData)) {
    return { errors: { consent: ["필수 항목에 모두 동의해 주세요."] } };
  }

  const claimKey = attemptKey("claim", await getClientIp());

  if (await isRateLimited(claimKey, AUTH_LIMITS.claimIp)) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  let claimedUserId: string | null = null;

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await claimMemberAccount(code, { email, passwordHash });

    if (result.status === "claimed") {
      claimedUserId = result.id;

      await prisma.user.update({
        where: { id: result.id },
        data: { termsVersion: TERMS_VERSION, termsAgreedAt: new Date() },
      });
    }
  } catch (error) {
    if (error instanceof ConnectionError) {
      // 코드를 추측하는 시도를 막으려고 실패만 센다.
      await recordAttempt(claimKey);

      return {
        message: error.message,
      };
    }

    throw error;
  }

  return finishWithMail(email, claimedUserId);
}

async function loginImpl(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validated.data;

  const ip = await getClientIp();
  const accountKey = attemptKey("login", ip, email);
  const ipKey = attemptKey("login", ip);

  if (
    (await isRateLimited(accountKey, AUTH_LIMITS.loginAccount)) ||
    (await isRateLimited(ipKey, AUTH_LIMITS.loginIp))
  ) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      emailVerifiedAt: true,
      trainerProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  const invalidMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";

  const matched = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user?.passwordHash || !matched) {
    await Promise.all([recordAttempt(accountKey), recordAttempt(ipKey)]);

    return {
      message: invalidMessage,
    };
  }

  // 이메일 인증 전(가입 직후이거나 이어받기 중)이면 로그인시키지 않고 인증 메일을 다시 보낸다.
  // 비밀번호가 맞았으므로 본인이고, 계정이 있다는 사실을 숨길 필요가 없다.
  if (
    !user.emailVerifiedAt &&
    (user.status === "ACTIVE" || user.status === "PENDING")
  ) {
    await clearAttempts(accountKey);

    return finishWithMail(email, user.id);
  }

  if (user.status !== "ACTIVE") {
    return {
      message: "이용이 제한된 계정입니다.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await clearAttempts(accountKey);
  await createSession(user.id);

  if (user.trainerProfile) {
    redirect("/trainer");
  }

  redirect("/home");
}

/** 실패했을 때 폼을 다시 채울 수 있게, 입력값(비밀번호 제외)을 결과에 실어 보낸다. */
function withValues(result: AuthFormState, formData: FormData): AuthFormState {
  if (!result) return result;

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };

  return {
    ...result,
    values: { role: text("role"), name: text("name"), email: text("email") },
  };
}

export async function signup(state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return withValues(await signupImpl(state, formData), formData);
}

export async function claimAccount(state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return withValues(await claimAccountImpl(state, formData), formData);
}

export async function login(state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return withValues(await loginImpl(state, formData), formData);
}

export async function logout() {
  await deleteSession();

  redirect("/login");
}

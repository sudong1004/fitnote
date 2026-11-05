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

const SALT_ROUNDS = 10;

/**
 * 없는 계정에도 같은 시간만큼 bcrypt 를 돌리기 위한 값.
 * 이게 없으면 없는 이메일이 눈에 띄게 빨리 돌아와 응답 시간으로 계정이 드러난다.
 */
const DUMMY_HASH =
  "$2b$10$kLb.J.yOyj1k9CAE8neuN.Giho6zF0SBQo5Al70SWGVLMLfWbPUoC";

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

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return {
      message: "이미 가입된 이메일이에요.",
    };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user: { id: string };

  try {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        termsVersion: TERMS_VERSION,
        termsAgreedAt: new Date(),
        ...(isTrainer
          ? { trainerProfile: { create: {} } }
          : { memberProfile: { create: {} } }),
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    // 위에서 조회할 때는 없었는데 그 사이에 같은 이메일로 가입한 경우(버튼을 두 번 누른
    // 경우 포함). 서버 오류 화면 대신 같은 안내를 보여 준다.
    if ((error as { code?: string })?.code === "P2002") {
      return { message: "이미 가입된 이메일이에요." };
    }

    throw error;
  }

  await createSession(user.id);

  redirect(isTrainer ? "/trainer" : "/home");
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

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await claimMemberAccount(code, {
      email,
      passwordHash,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { termsVersion: TERMS_VERSION, termsAgreedAt: new Date() },
    });

    await createSession(user.id);

    redirect("/home");
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

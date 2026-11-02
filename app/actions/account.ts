"use server";

import { revalidatePath } from "next/cache";

import { getOptionalSession, requireUser } from "@/app/lib/dal";
import {
  type AccountFormState,
  PasswordChangeSchema,
  ProfileFormSchema,
  TrainerIntroSchema,
} from "@/app/lib/definitions";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  attemptKey,
  clearAttempts,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";
import {
  changePassword,
  updateMyProfile,
  updateTrainerIntro,
} from "@/server/account/account.service";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** 이름·전화번호, 트레이너면 소개까지 한 번에 저장한다. */
export async function saveProfile(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();

  const profile = ProfileFormSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
  });
  const intro = user.isTrainer
    ? TrainerIntroSchema.safeParse({
        displayName: text(formData, "displayName"),
        specialty: text(formData, "specialty"),
        careerYears: text(formData, "careerYears"),
        bio: text(formData, "bio"),
      })
    : null;

  if (!profile.success || (intro && !intro.success)) {
    return {
      errors: {
        ...(profile.success ? {} : profile.error.flatten().fieldErrors),
        ...(intro && !intro.success ? intro.error.flatten().fieldErrors : {}),
      },
    };
  }

  await updateMyProfile(user.id, profile.data);
  if (intro?.success) await updateTrainerIntro(user.id, intro.data);

  // 이름은 거의 모든 화면 머리에 나온다. 레이아웃째로 다시 그린다.
  revalidatePath("/", "layout");

  return { ok: true, message: "저장했어요." };
}

export async function savePassword(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();
  const session = await getOptionalSession();
  if (!session) return { message: "다시 로그인해 주세요." };

  const validated = PasswordChangeSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    newPassword: text(formData, "newPassword"),
    confirmPassword: text(formData, "confirmPassword"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  // 로그인된 기기를 손에 넣은 사람이 지금 비밀번호를 맞혀 보는 것을 막는다.
  const key = attemptKey("password-change", user.id);
  if (await isRateLimited(key, AUTH_LIMITS.loginAccount)) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const result = await changePassword(user.id, session.sessionId, validated.data);

  if (result === "wrong-password") {
    await recordAttempt(key);
    return { errors: { currentPassword: ["지금 비밀번호가 맞지 않아요."] } };
  }

  await clearAttempts(key);

  return { ok: true, message: "비밀번호를 바꿨어요. 다른 기기는 로그아웃됐어요." };
}

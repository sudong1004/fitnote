import * as z from "zod";

import { cleanText } from "@/lib/text";

/**
 * 정규화한 뒤에 형식을 검사한다.
 *
 * 형식 검사가 먼저 돌면 앞뒤 공백이 있는 값이 걸러지고, 대소문자가 다른 같은
 * 주소가 서로 다른 계정으로 들어간다. 소문자로 통일해야 가입과 로그인이 맞물린다.
 */
const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "이메일이 너무 길어요." })
  .pipe(z.email({ error: "올바른 이메일 형식이 아닙니다." }));

/**
 * 새 비밀번호 규칙. 가입·이어받기·변경·재설정이 모두 같은 규칙을 쓴다.
 *
 * - trim 하지 않는다. 앞뒤 공백도 비밀번호의 일부다. 가입 때만 잘라 두면 로그인에서
 *   공백을 넣어 친 사람이 영영 못 들어온다.
 * - bcrypt 는 72바이트 뒤를 버린다. 그보다 긴 값은 뒤쪽이 의미 없는 채로 저장되므로
 *   처음부터 받지 않는다. 한글은 글자당 3바이트라 글자 수가 아니라 바이트로 센다.
 */
export const PasswordSchema = z
  .string()
  .min(8, { error: "비밀번호는 8자 이상이어야 합니다." })
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    error: "비밀번호가 너무 길어요. 영문·숫자 기준 72자 이하로 정해 주세요.",
  })
  .regex(/[a-zA-Z]/, { error: "영문을 최소 1자 포함해야 합니다." })
  .regex(/[0-9]/, { error: "숫자를 최소 1자 포함해야 합니다." });

const SAME_PASSWORD_ERROR = "비밀번호가 서로 달라요.";

// 공백을 먼저 자른 뒤 길이를 센다. 반대로 하면 " a" 가 2자로 통과한다.
const NameSchema = z
  .string()
  .transform(cleanText)
  .pipe(
    z
      .string()
      .trim()
      .min(2, { error: "이름은 2자 이상 입력해주세요." })
      .max(20, { error: "이름은 20자 이하로 입력해주세요." }),
  );

export const SignupFormSchema = z
  .object({
    name: NameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: SAME_PASSWORD_ERROR,
    path: ["confirmPassword"],
  });

/**
 * 트레이너가 만들어 둔 계정을 이어받을 때.
 *
 * 이름을 받지 않는다. 이름은 트레이너가 이미 적어 뒀고, 그 이름으로 알림장과
 * 수업이 쌓여 있다. 여기서 다시 물으면 회원이 다른 이름을 적을 수 있고 그러면
 * 트레이너의 목록에서 사람이 바뀐 것처럼 보인다.
 */
export const ClaimFormSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: SAME_PASSWORD_ERROR,
    path: ["confirmPassword"],
  });

export const LoginFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: "비밀번호를 입력해주세요." }),
});

export type AuthFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        confirmPassword?: string[];
        consent?: string[];
      };
      message?: string;
      /**
       * 방금 입력한 값. 실패해도 React 가 폼을 비우므로, 이름·이메일·가입 유형은
       * 서버가 돌려줘서 다시 채운다. 비밀번호는 돌려주지 않는다.
       */
      values?: { role?: string; name?: string; email?: string };
    }
  | undefined;

/** 빈칸은 "지운다"는 뜻이라 null 로 바꾼다. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .trim()
        .max(max, { error: `${label}은(는) ${max}자 이하로 입력해주세요.` }),
    )
    .transform((value) => (value === "" ? null : value));

/**
 * 내 정보 수정.
 *
 * 이메일은 로그인 아이디라 여기서 바꾸지 않는다. 바꾸게 하려면 새 주소가
 * 정말 본인 것인지 확인하는 단계가 먼저 있어야 한다.
 */
export const ProfileFormSchema = z.object({
  name: NameSchema,
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9+\-\s()]{9,20}$/.test(value), {
      error: "전화번호는 숫자와 - 만 써서 입력해주세요.",
    })
    .transform((value) => (value === "" ? null : value)),
});

/** 트레이너 소개. 회원에게 보이는 이름과 소개 글이다. */
export const TrainerIntroSchema = z.object({
  displayName: optionalText(20, "활동 이름"),
  specialty: optionalText(60, "전문 분야"),
  careerYears: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,2}$/.test(value) && Number(value) <= 60), {
      error: "경력은 0~60 사이 숫자로 입력해주세요.",
    })
    .transform((value) => (value === "" ? null : Number(value))),
  bio: optionalText(500, "소개"),
});

export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "지금 비밀번호를 입력해주세요." }),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: "새 비밀번호가 서로 달라요.",
    path: ["confirmPassword"],
  });

export type AccountFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      ok?: boolean;
    }
  | undefined;

export const ForgotPasswordSchema = z.object({ email: EmailSchema });

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(20, { error: "링크가 올바르지 않아요." }),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: "새 비밀번호가 서로 달라요.",
    path: ["confirmPassword"],
  });

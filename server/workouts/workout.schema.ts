import * as z from "zod";

import { cleanText } from "@/lib/text";

/** 길이를 세기 전에 저장할 수 없는 글자를 뺀다. */
const text = (max: number, error: string) =>
  z.string().transform(cleanText).pipe(z.string().max(max, { error }));

const NUMBER_ERROR = "숫자로 입력해주세요.";

export const StartSessionSchema = z.object({
  routineId: z.uuid({ error: "올바른 루틴 ID가 아닙니다." }).optional(),
  memo: text(500, "메모는 500자 이하로 입력해주세요.").optional(),
  // ask: 진행중 세션이 있으면 409 로 알려준다 (사용자에게 물어보기 위함)
  mode: z.enum(["ask", "resume", "new"]).default("ask"),
});

export const UpdateSessionSchema = z.object({
  action: z.enum(["finish", "cancel", "memo"]),
  memo: text(500, "메모는 500자 이하로 입력해주세요.").nullish(),
  /** 몰아서 입력한 기록의 운동 시간(분). 실시간 기록에서는 무시한다. */
  durationMinutes: z
    .number({ error: NUMBER_ERROR })
    .int()
    .min(1)
    .max(1440)
    .nullish(),
});

export const AddRecordSchema = z.object({
  exerciseId: z.uuid({ error: "올바른 운동 ID가 아닙니다." }),
  note: text(500, "메모는 500자 이하로 입력해주세요.").optional(),
});

/**
 * 세트 입력.
 * 중량은 0 이상(맨몸 운동은 0), 횟수는 1 이상.
 * 상한을 두어 오타로 말도 안 되는 값이 통계에 섞이지 않게 한다.
 */
export const SetInputSchema = z.object({
  weight: z
    .number({ error: NUMBER_ERROR })
    .min(0, { error: "중량은 0 이상이어야 합니다." })
    .max(1000, { error: "중량이 너무 큽니다." })
    .nullish(),
  reps: z
    .number({ error: NUMBER_ERROR })
    .int({ error: "횟수는 정수여야 합니다." })
    .min(0, { error: "횟수는 0 이상이어야 합니다." })
    .max(1000, { error: "횟수가 너무 큽니다." })
    .nullish(),
  restSeconds: z
    .number({ error: NUMBER_ERROR })
    .int({ error: "휴식 시간은 정수여야 합니다." })
    .min(0, { error: "휴식 시간은 0초 이상이어야 합니다." })
    .max(3600, { error: "휴식 시간이 너무 깁니다." })
    .nullish(),
  completed: z.boolean({ error: "잘못된 값입니다." }).optional(),
  rpe: z
    .number({ error: NUMBER_ERROR })
    .min(1, { error: "RPE 는 1~10 사이여야 합니다." })
    .max(10, { error: "RPE 는 1~10 사이여야 합니다." })
    .nullish(),
  note: text(300, "메모는 300자 이하로 입력해주세요.").nullish(),
});

export const ListSessionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

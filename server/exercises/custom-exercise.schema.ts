import * as z from "zod";

import { WorkoutBodyPart } from "@/generated/prisma/enums";
import { cleanText } from "@/lib/text";

/** 한 사람이 만들 수 있는 운동 수. 목록 화면이 한 번에 불러오는 100개를 넘기지 않게 둔다. */
export const MAX_CUSTOM_EXERCISES = 100;

/** 앞뒤 공백을 자르고 가운데의 연속 공백·줄바꿈을 한 칸으로 줄인다. */
const oneLine = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

const optionalText = (max: number, error: string) =>
  z
    .string()
    .transform((value) => cleanText(value).trim())
    .pipe(z.string().max(max, { error }))
    .transform((value) => (value === "" ? null : value))
    .nullish()
    .transform((value) => value ?? null);

export const CustomExerciseSchema = z.object({
  name: z
    .string({ error: "운동 이름을 입력해주세요." })
    .transform(oneLine)
    .pipe(
      z
        .string()
        .min(1, { error: "운동 이름을 입력해주세요." })
        .max(40, { error: "운동 이름은 40자 이하로 입력해주세요." }),
    ),
  bodyPart: z.enum(Object.values(WorkoutBodyPart) as [WorkoutBodyPart, ...WorkoutBodyPart[]], {
    error: "부위를 골라주세요.",
  }),
  targetMuscle: optionalText(30, "자극 부위는 30자 이하로 입력해주세요."),
  description: optionalText(500, "메모는 500자 이하로 입력해주세요."),
});

export type CustomExerciseInput = z.infer<typeof CustomExerciseSchema>;

import { describe, expect, it } from "vitest";

import { SetInputSchema } from "@/server/workouts/workout.schema";

describe("SetInputSchema", () => {
  it("정상 값과 빈 값을 받는다", () => {
    expect(SetInputSchema.safeParse({ weight: 60, reps: 10 }).success).toBe(
      true,
    );
    expect(SetInputSchema.safeParse({ weight: null, reps: null }).success).toBe(
      true,
    );
  });

  it.each([
    ["음수 중량", { weight: -1 }],
    ["터무니없는 중량", { weight: 5000 }],
    ["소수 횟수", { reps: 2.5 }],
    ["RPE 범위 밖", { rpe: 11 }],
    ["메모 너무 김", { note: "a".repeat(301) }],
  ])("%s 는 거절한다", (_label, input) => {
    expect(SetInputSchema.safeParse(input).success).toBe(false);
  });

  it("숫자 자리에 글자가 오면 한국어로 알려 준다", () => {
    const parsed = SetInputSchema.safeParse({ weight: "abc" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("숫자로 입력해주세요.");
  });

  it("저장할 수 없는 글자(NUL)는 메모에서 뺀다", () => {
    const parsed = SetInputSchema.safeParse({ note: "무릎\u0000 조심" });

    expect(parsed.success && parsed.data.note).toBe("무릎 조심");
  });
});

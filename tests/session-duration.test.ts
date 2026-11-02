import { describe, expect, it } from "vitest";

import { isValidSessionDuration, parseSessionDuration } from "@/lib/session-duration";

describe("수업 시간 값", () => {
  it("폼 값을 분으로 바꾼다", () => {
    expect(parseSessionDuration(null)).toBeUndefined();
    expect(parseSessionDuration("  ")).toBeUndefined();
    expect(parseSessionDuration("45")).toBe(45);
    expect(parseSessionDuration("abc")).toBeNaN();
  });

  it("10~240 정수만 유효하다", () => {
    expect([10, 60, 240].every(isValidSessionDuration)).toBe(true);
    expect([9, 241, 1.5, Number.NaN].some(isValidSessionDuration)).toBe(false);
  });
});

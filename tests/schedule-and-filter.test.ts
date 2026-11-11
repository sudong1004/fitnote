import { describe, expect, it } from "vitest";

import { parseMemberFilter } from "@/app/trainer/members/member-filter";
import { nextFreeTime } from "@/app/trainer/schedule/next-free-time";
import {
  isDateKey,
  isMonthKey,
  isPastOrTodayKey,
  kstDateTimeToUtc,
  kstDateToUtc,
  toKstDateKey,
  toKstTimeValue,
} from "@/lib/date";

/** KST 시각으로 수업을 만든다. */
const at = (time: string, durationMinutes = 50, status = "SCHEDULED") => ({
  scheduledAt: kstDateTimeToUtc("2026-09-08", time)!,
  durationMinutes,
  status,
});

describe("nextFreeTime", () => {
  it("수업이 없으면 저녁 7시", () => {
    expect(nextFreeTime([])).toBe("19:00");
  });

  it("마지막 수업이 끝나는 시각을 쓴다", () => {
    expect(nextFreeTime([at("10:00", 60), at("14:00", 60)])).toBe("15:00");
  });

  it("5분 단위로 올린다", () => {
    expect(nextFreeTime([at("10:00", 47)])).toBe("10:50");
  });

  it("취소된 수업은 세지 않는다", () => {
    expect(nextFreeTime([at("10:00", 60), at("15:00", 60, "CANCELLED")])).toBe(
      "11:00",
    );
  });

  it("밤을 넘기거나 새벽이면 저녁으로 되돌린다", () => {
    expect(nextFreeTime([at("22:00", 60)])).toBe("19:00");
    expect(nextFreeTime([at("03:00", 30)])).toBe("19:00");
  });
});

describe("parseMemberFilter", () => {
  it("유효한 값은 그대로, 아니면 전체", () => {
    expect(parseMemberFilter("attention")).toBe("attention");
    expect(parseMemberFilter("soon")).toBe("soon");
    expect(parseMemberFilter("evil")).toBe("all");
    expect(parseMemberFilter(undefined)).toBe("all");
  });
});

describe("KST 날짜", () => {
  it("UTC 15시 이후는 KST 로 다음 날", () => {
    expect(toKstDateKey(new Date("2026-09-08T15:30:00Z"))).toBe("2026-09-09");
    expect(toKstDateKey(new Date("2026-09-08T14:59:00Z"))).toBe("2026-09-08");
  });

  it("폼 값을 KST 로 읽고 잘못된 값은 null", () => {
    expect(kstDateToUtc("2026-09-08")?.toISOString()).toBe(
      "2026-09-07T15:00:00.000Z",
    );
    expect(kstDateToUtc("2026-9-8")).toBeNull();
    // 없는 날을 다음 달로 넘겨 읽지 않는다.
    expect(kstDateToUtc("2026-02-31")).toBeNull();
    expect(kstDateTimeToUtc("2026-09-08", "25:99")).toBeNull();
    expect(toKstTimeValue(kstDateTimeToUtc("2026-09-08", "19:05")!)).toBe(
      "19:05",
    );
  });
});

describe("주소·폼으로 들어온 날짜", () => {
  it("실제로 있는 날이고 2000~2100년 안일 때만 받는다", () => {
    expect(isDateKey("2026-11-11")).toBe(true);
    expect(isDateKey("2026-02-31")).toBe(false);
    expect(isDateKey("0001-01-01")).toBe(false);
    expect(isDateKey("9999-12-31")).toBe(false);
    expect(isDateKey("zzzz")).toBe(false);
    expect(isDateKey(["2026-11-11"])).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it("지난 일을 적는 폼은 오늘까지만 받는다", () => {
    const today = toKstDateKey(new Date());
    const tomorrow = toKstDateKey(new Date(Date.now() + 86_400_000));

    expect(isPastOrTodayKey(today)).toBe(true);
    expect(isPastOrTodayKey(tomorrow)).toBe(false);
    expect(isPastOrTodayKey("1999-12-31")).toBe(false);
  });

  it("달은 01~12 만 받는다", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("0000-00")).toBe(false);
    expect(isMonthKey("9999-12")).toBe(false);
  });
});

/**
 * 날짜 유틸.
 *
 * 서비스 대상이 국내 사용자라 날짜 경계를 KST 로 고정한다.
 * Vercel 서버는 UTC 로 도므로 서버의 로컬 시간으로 하루를 나누면
 * 밤 9시 이후 운동이 다음 날로 밀린다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜 키 (YYYY-MM-DD) */
export function toKstDateKey(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 기준 그 날 0시에 해당하는 시각 */
export function kstStartOfDay(date: Date = new Date()) {
  return new Date(`${toKstDateKey(date)}T00:00:00+09:00`);
}

/** KST 기준으로 days 일 전 0시 */
export function kstDaysAgo(days: number, from: Date = new Date()) {
  const start = kstStartOfDay(from);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** KST 기준 요일 한 글자 */
export function kstWeekdayLabel(date: Date) {
  return WEEKDAY[new Date(date.getTime() + KST_OFFSET_MS).getUTCDay()];
}

/** KST 기준 "9월 4일 (목)" */
export function formatKstDateLabel(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${kstWeekdayLabel(date)})`;
}

/** KST 기준 월 키 (YYYY-MM) */
export function toKstMonthKey(date: Date = new Date()) {
  return toKstDateKey(date).slice(0, 7);
}

/** YYYY-MM 을 months 만큼 옮긴다. */
export function shiftMonthKey(monthKey: string, months: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 해당 월의 KST 시작/끝(다음 달 1일 0시) */
export function kstMonthRange(monthKey: string) {
  const start = new Date(`${monthKey}-01T00:00:00+09:00`);
  const end = new Date(`${shiftMonthKey(monthKey, 1)}-01T00:00:00+09:00`);
  return { start, end };
}

/**
 * 달력 그리드에 그릴 날짜들.
 *
 * 일요일부터 시작하도록 앞뒤를 이전/다음 달 날짜로 채워 항상 7의 배수로 맞춘다.
 * 빈 칸으로 두면 주 단위 줄이 어긋난다.
 */
export function buildMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { dateKey: string; inMonth: boolean }[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - i)));
    cells.push({ dateKey: date.toISOString().slice(0, 10), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${monthKey}-${String(day).padStart(2, "0")}`,
      inMonth: true,
    });
  }

  for (let extra = 1; cells.length % 7 !== 0; extra += 1) {
    const next = new Date(Date.UTC(year, month - 1, daysInMonth + extra));
    cells.push({ dateKey: next.toISOString().slice(0, 10), inMonth: false });
  }

  return cells;
}

/** 초를 "1시간 12분" / "12분" 형태로 */
export function formatDuration(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
  return `${minutes}분`;
}

/** 초를 스톱워치처럼 "12:34" / "1:02:15" 형태로 */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_VALUE = /^\d{2}:\d{2}$/;

/**
 * 폼에서 온 "2026-09-08" 을 KST 그 날 0시로 읽는다.
 *
 * `new Date("2026-09-08")` 은 UTC 0시로 읽혀 KST 로는 전날 오전 9시가 된다.
 * 형식이 어긋나면 null 을 돌려 부르는 쪽이 입력 오류로 다루게 한다.
 */
export function kstDateToUtc(dateKey: string) {
  if (!DATE_KEY.test(dateKey)) return null;

  const date = new Date(`${dateKey}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;

  // 2월 31일 같은 없는 날은 엔진이 3월 3일로 넘겨 읽는다. 적은 날과 다르면 받지 않는다.
  return toKstDateKey(date) === dateKey ? date : null;
}

/**
 * 우리가 다루는 날짜의 범위.
 *
 * 주소나 폼으로 0001년, 9999년 같은 값이 들어오면 달력과 그래프가 깨지거나 DB 가
 * 거절한다. 실제로 쓸 일이 없는 범위는 처음부터 받지 않는다.
 */
export const MIN_DATE_KEY = "2000-01-01";
export const MAX_DATE_KEY = "2100-12-31";

/** 실제로 있는 날이고 2000~2100년 안인가. */
export function isDateKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    kstDateToUtc(value) !== null &&
    value >= MIN_DATE_KEY &&
    value <= MAX_DATE_KEY
  );
}

/** 오늘(KST)까지의 날인가. 지난 일을 적는 폼이 쓴다. */
export function isPastOrTodayKey(value: unknown): value is string {
  return isDateKey(value) && value <= toKstDateKey(new Date());
}

/** YYYY-MM 이 실제로 있는 달이고 2000~2100년 안인가. */
export function isMonthKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    isDateKey(`${value}-01`)
  );
}

/** 폼에서 온 "2026-09-08" + "19:00" 을 KST 시각으로 읽는다. */
export function kstDateTimeToUtc(dateKey: string, time: string) {
  if (!DATE_KEY.test(dateKey) || !TIME_VALUE.test(time)) return null;

  const date = new Date(`${dateKey}T${time}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** KST 기준 "19:00" (input[type=time] 값) */
export function toKstTimeValue(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * KST 기준 "오후 7:00"
 *
 * Intl 에 맡기지 않는다. ko-KR 로 넘겨도 ICU 판에 따라 "오후" 대신 "PM" 이
 * 나온다. 로컬과 배포판의 ICU 가 달라서 여기서만 영어로 뜨는 일이 생긴다.
 */
export function formatKstTimeLabel(date: Date) {
  const [hour, minute] = toKstTimeValue(date).split(":").map(Number);
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${hour12}:${String(minute).padStart(2, "0")}`;
}

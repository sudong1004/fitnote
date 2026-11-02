/**
 * 수업 진행 시간(분)의 허용 범위.
 *
 * 입력칸(min·max·step)과 서버 검증이 같은 값을 쓰도록 한곳에 둔다. 브라우저 제한만
 * 있으면 요청을 직접 만들어 보낸 값(1.5분, 99999분, 음수)이 그대로 저장된다.
 */
export const SESSION_DURATION = { min: 10, max: 240, step: 5, default: 60 } as const;

export function isValidSessionDuration(minutes: number) {
  return (
    Number.isInteger(minutes) &&
    minutes >= SESSION_DURATION.min &&
    minutes <= SESSION_DURATION.max
  );
}

/** 폼 값 → 분. 비어 있으면 undefined(기본값 사용), 숫자가 아니면 NaN 을 그대로 넘겨 서버가 거절하게 한다. */
export function parseSessionDuration(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw === "" ? undefined : Number(raw);
}

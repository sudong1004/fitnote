/*
  체성분 화면의 실패 문구.

  서버 액션은 실패를 주소에 코드로만 싣는다. 서버가 만든 문장을 주소로 나르면
  주소창에 넣은 아무 문장이나 우리 화면에서 우리 말투로 뜬다.

  "use server" 파일은 함수만 내보낼 수 있어 표는 여기에 따로 둔다.
*/
const MESSAGE: Record<string, string> = {
  invalid: "넣은 값을 확인해주세요.",
  // 범위는 server/body/body.service.ts 의 METRIC·WAIST 와 같아야 한다.
  invalid_weight: "체중은 20~300kg 사이 숫자로 넣어주세요.",
  invalid_body_fat: "체지방률은 1~70% 사이 숫자로 넣어주세요.",
  invalid_muscle: "골격근량은 5~100kg 사이 숫자로 넣어주세요.",
  invalid_waist: "허리둘레는 30~200cm 사이 숫자로 넣어주세요.",
  invalid_date: "날짜를 확인해주세요. 기록은 오늘까지, 목표 날짜는 오늘부터 고를 수 있어요.",
  empty: "적어도 하나는 채워주세요.",
  not_found: "찾을 수 없어요.",
  unknown: "저장하지 못했어요. 잠시 후 다시 시도해주세요.",
};

/** 주소로 온 값이 우리가 아는 코드일 때만 문구를 고른다. */
export function bodyErrorMessage(raw: string | string[] | undefined) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return MESSAGE[raw] ?? MESSAGE.unknown;
}

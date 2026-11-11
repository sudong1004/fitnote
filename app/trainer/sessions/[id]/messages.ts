/*
  수업 기록 화면의 실패 문구.

  서버 액션은 실패를 주소에 코드로만 싣는다. 서버가 만든 문장을 주소로 나르면
  주소창에 넣은 아무 문장이나 우리 화면에서 우리 말투로 뜬다.

  "use server" 파일은 함수만 내보낼 수 있어 표는 여기에 따로 둔다.
*/
import { PT_ERROR_MESSAGE } from "@/app/trainer/members/[id]/contracts/messages";

const MESSAGE: Record<string, string> = {
  ...PT_ERROR_MESSAGE,
  pick: "무엇을 할지 골라 주세요.",
  journal: "알림장을 시작할 수 없어요.",
  when: "날짜와 시각을 확인해주세요.",
  past: "지난 시각에는 잡을 수 없어요.",
  not_my_member: "담당 회원이 아니에요.",
};

/** 주소로 온 값이 우리가 아는 코드일 때만 문구를 고른다. */
export function sessionErrorMessage(raw: string | string[] | undefined) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return MESSAGE[raw] ?? MESSAGE.unknown;
}

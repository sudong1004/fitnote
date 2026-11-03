/**
 * 약관·개인정보처리방침 판과 운영자 정보.
 *
 * 문서를 고치면 TERMS_VERSION 을 그날 날짜로 바꾼다. 가입할 때 이 값이 User.termsVersion 에
 * 남아서, 누가 어느 판에 동의했는지 알 수 있다.
 *
 * 출시 전에 아래 [ ] 칸을 실제 값으로 채워야 한다.
 */
export const TERMS_VERSION = "2026-11-03";
export const TERMS_EFFECTIVE_LABEL = "2026년 11월 3일";

export const OPERATOR = {
  /** 개인이면 이름, 사업자면 상호 */
  name: "[운영자 이름 또는 상호]",
  /** 개인정보 보호책임자 */
  privacyOfficer: "[개인정보 보호책임자 이름]",
  email: "[문의 이메일]",
};

/** 가입 폼의 필수 동의 칸 이름. 서버는 이 칸이 모두 "on" 이어야 가입시킨다. */
export const CONSENT_FIELDS = ["agreeAge", "agreeTerms", "agreePrivacy", "agreeSensitive"] as const;

export function hasAllConsents(formData: FormData) {
  return CONSENT_FIELDS.every((name) => formData.get(name) === "on");
}

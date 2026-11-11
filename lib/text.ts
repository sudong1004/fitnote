/**
 * 저장할 수 없는 글자를 뺀다.
 *
 * Postgres 의 text 는 NUL(0x00)을 받지 않는다. 화면에서는 넣을 수 없는 글자지만
 * 요청을 직접 만들어 보내면 들어오고, 그대로 저장하려 하면 쿼리가 통째로 실패해
 * 오류 화면이 뜬다. 값을 받는 자리에서 먼저 지운다.
 */
export function cleanText(value: string) {
  return value.replace(/\u0000/g, "");
}

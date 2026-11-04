/**
 * 메일 본문 틀. 메일 앱은 CSS 지원이 제각각이라 표 + 인라인 스타일로만 만든다.
 * 색은 앱과 같은 딥그린(#2f6b53)·민트(#5fd3a8). 글꼴은 기기에 있는 한글 글꼴을 쓴다.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMail(input: {
  /** 받은편지함 목록에서 제목 옆에 보이는 요약 */
  preheader: string;
  title: string;
  /** 문단들. 이미 안전한(이스케이프된) HTML 이 아니라 평문을 넘긴다. */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** 버튼 아래 작은 안내 */
  note?: string;
}) {
  const paragraphs = input.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#2b3631">${escapeHtml(text)}</p>`,
    )
    .join("");

  const button = input.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 8px"><tr><td style="border-radius:999px;background:#2f6b53"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:15px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;font-family:${FONT}">${escapeHtml(input.button.label)}</a></td></tr></table>
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#68736d">버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br><a href="${escapeHtml(input.button.url)}" style="color:#2f6b53;word-break:break-all">${escapeHtml(input.button.url)}</a></p>`
    : "";

  const note = input.note
    ? `<div style="margin-top:26px;padding:14px 16px;border-radius:14px;background:#f5f6f5;font-size:13px;line-height:1.6;color:#5f6a64">${escapeHtml(input.note)}</div>`
    : "";

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#eef1ef">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef1ef"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;font-family:${FONT}">
    <tr><td style="padding:0 6px 14px;font-size:19px;font-weight:800;letter-spacing:-0.3px;color:#2f6b53">FitNote</td></tr>
    <tr><td style="background:#ffffff;border-radius:24px;overflow:hidden">
      <div style="height:6px;background:#5fd3a8"></div>
      <div style="padding:32px 28px 30px">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.35;font-weight:800;letter-spacing:-0.4px;color:#17241e">${escapeHtml(input.title)}</h1>
        ${paragraphs}
        ${button}
        ${note}
      </div>
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#68736d">이 메일은 FitNote에서 자동으로 보냈어요. 답장은 확인하지 않아요.</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

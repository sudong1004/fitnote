import "server-only";

/**
 * 메일 보내기 (Resend).
 *
 * RESEND_API_KEY 와 MAIL_FROM("FitNote <no-reply@도메인>") 이 있어야 보낸다.
 * 없으면 개발 환경에서는 내용을 서버 로그에 남기고, 운영 환경에서는 오류를 남긴다.
 * 어느 경우든 화면에는 같은 안내를 보여 줘서, 가입된 메일인지 드러나지 않게 한다.
 */
export async function sendMail(input: { to: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail] (발송 설정 없음) to=${input.to} subject=${input.subject}\n${input.text}`);
    } else {
      console.error("[mail] RESEND_API_KEY 또는 MAIL_FROM 이 없어 메일을 보내지 못했어요.");
    }
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
  });

  if (!response.ok) {
    console.error(`[mail] 발송 실패 ${response.status}: ${await response.text().catch(() => "")}`);
    return false;
  }

  return true;
}

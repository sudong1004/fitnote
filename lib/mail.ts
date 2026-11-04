import "server-only";

import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html: string };

/**
 * 메일 보내기.
 *
 * 두 방식 중 설정된 쪽으로 보낸다.
 * 1) SMTP (Gmail 등): SMTP_USER, SMTP_PASS(앱 비밀번호) 가 있으면 쓴다.
 *    SMTP_HOST 기본값은 smtp.gmail.com, MAIL_FROM 이 없으면 "FitNote <SMTP_USER>".
 * 2) Resend: RESEND_API_KEY, MAIL_FROM("FitNote <no-reply@내도메인>").
 *
 * 둘 다 없으면 개발 환경에서는 내용을 서버 로그에 남기고, 운영 환경에서는 오류를 남긴다.
 * 어느 경우든 화면에는 같은 안내를 보여 줘서, 가입된 메일인지 드러나지 않게 한다.
 */
export async function sendMail(input: Mail) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) return sendWithSmtp(input, smtpUser, smtpPass);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (apiKey && from) return sendWithResend(input, apiKey, from);

  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail] (발송 설정 없음) to=${input.to} subject=${input.subject}\n${input.text}`);
  } else {
    console.error("[mail] 메일 발송 설정(SMTP_USER/SMTP_PASS 또는 RESEND_API_KEY/MAIL_FROM)이 없어요.");
  }
  return false;
}

async function sendWithSmtp(input: Mail, user: string, pass: string) {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_PORT || "465") === "465",
      auth: { user, pass },
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || `FitNote <${user}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (error) {
    console.error("[mail] SMTP 발송 실패", error);
    return false;
  }
}

async function sendWithResend(input: Mail, apiKey: string, from: string) {
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

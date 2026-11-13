import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * 오류 수집(Sentry) 공통 설정. 서버와 브라우저가 같이 쓴다.
 *
 * 이 앱은 식단·체중 같은 민감한 기록을 다룬다. 오류를 찾는 데 필요한 것(오류 내용, 난 위치,
 * 화면 경로, 브라우저 종류)만 보내고, 사람이 적은 내용과 누구인지 알 수 있는 값은 보내지 않는다.
 *
 * - 요청 본문·쿠키·헤더는 지운다(폼에 적은 값, 세션 쿠키가 들어 있다)
 * - 주소의 ? 뒤는 지운다(이메일 인증·비밀번호 재설정 링크의 토큰이 들어 있다)
 * - 사용자 정보(IP, 이메일)는 붙이지 않는다
 * - 화면 녹화(Replay)와 성능 추적은 쓰지 않는다
 *
 * DSN 이 없으면(로컬, 자동 테스트) 아무것도 보내지 않는다.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

const withoutQuery = (url: string) => url.split(/[?#]/)[0];

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"] ?? event.request.headers?.["User-Agent"];
    event.request = {
      method: event.request.method,
      url: event.request.url ? withoutQuery(event.request.url) : undefined,
      headers: userAgent ? { "user-agent": userAgent } : undefined,
    };
  }
  delete event.user;
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // 화면에 찍힌 로그와 누른 요소의 글자에는 사람이 적은 내용이 섞일 수 있다.
  if (breadcrumb.category === "console" || breadcrumb.category?.startsWith("ui.")) return null;

  const data = breadcrumb.data;
  if (data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = withoutQuery(data[key]);
    }
  }
  return breadcrumb;
}

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};

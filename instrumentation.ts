import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

/**
 * 서버가 뜰 때 한 번 불린다. 서버 쪽 오류 수집을 켠다.
 *
 * 서버 액션과 API 는 오류를 잡아서 `console.error` 로 남기고 화면에는 안내 문구만 돌려준다.
 * 그래서 `console.error` 로 남긴 것도 함께 모은다. 안 그러면 대부분의 오류가 빠진다.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  Sentry.init({
    ...sentryOptions,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  });
}

/** 화면을 그리다, 또는 요청을 처리하다 잡히지 않은 서버 오류. */
export const onRequestError = Sentry.captureRequestError;

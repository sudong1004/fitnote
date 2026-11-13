import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

/** 브라우저에서 앱이 뜨기 전에 한 번 실행된다. 브라우저 쪽 오류 수집을 켠다. */
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

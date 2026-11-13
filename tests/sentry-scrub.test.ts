import { describe, expect, it } from "vitest";

import type { ErrorEvent } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry";

describe("오류 수집으로 보내기 전에 지우는 것", () => {
  it("요청 본문·쿠키·헤더와 주소의 토큰, 사용자 정보를 지운다", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: "POST",
        url: "https://fitnote.example/verify-email?token=secret-token",
        query_string: "token=secret-token",
        cookies: { fitnote_session: "jwt" },
        data: { email: "a@b.co", password: "pw" },
        headers: { cookie: "fitnote_session=jwt", "user-agent": "Safari" },
      },
      user: { ip_address: "1.2.3.4", email: "a@b.co" },
    } as ErrorEvent);

    expect(event.request).toEqual({
      method: "POST",
      url: "https://fitnote.example/verify-email",
      headers: { "user-agent": "Safari" },
    });
    expect(event.user).toBeUndefined();
    expect(JSON.stringify(event)).not.toMatch(/secret-token|jwt|a@b\.co|1\.2\.3\.4/);
  });

  it("화면 이동 기록의 주소에서 ? 뒤를 지운다", () => {
    const crumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/login", to: "/reset-password?token=abc" },
    });
    expect(crumb?.data).toEqual({ from: "/login", to: "/reset-password" });
  });

  it("콘솔 로그와 누른 요소 기록은 보내지 않는다", () => {
    expect(scrubBreadcrumb({ category: "console", message: "식단 메모" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.click", message: "button" })).toBeNull();
  });
});

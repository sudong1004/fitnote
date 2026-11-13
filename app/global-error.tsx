"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

/**
 * 루트 레이아웃 자체가 실패했을 때의 마지막 화면.
 *
 * 루트 레이아웃을 대신하므로 html·body 를 직접 그리고, globals.css 가 적용되지
 * 않아 색과 크기를 여기에 직접 적는다(값은 globals.css 의 토큰과 같다).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.5rem",
          textAlign: "center",
          wordBreak: "keep-all",
          background: "#ffffff",
          color: "#17241e",
          fontFamily:
            '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        }}
      >
        <title>FitNote</title>
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
          화면을 불러오지 못했어요
        </h1>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", opacity: 0.65 }}>
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "1.75rem",
            width: "100%",
            maxWidth: "25rem",
            height: "3.25rem",
            border: 0,
            borderRadius: "9999px",
            background: "#2f6b53",
            color: "#ffffff",
            fontSize: "0.9375rem",
            fontWeight: 800,
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}

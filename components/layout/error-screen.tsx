"use client";

import { useEffect } from "react";
import Link from "next/link";

import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";

import {
  StatusScreen,
  statusPrimaryAction,
  statusSecondaryAction,
} from "@/components/layout/status-screen";

/**
 * 화면을 그리다 오류가 났을 때 보여 준다. error.tsx 들이 이 컴포넌트를 쓴다.
 *
 * 운영에서는 서버 오류의 내용이 브라우저로 오지 않고 식별값(digest)만 온다.
 * 문의가 왔을 때 서버 로그와 맞춰 볼 수 있게 그 값을 작게 보여 준다.
 */
export function ErrorScreen({
  error,
  retry,
  full = false,
}: {
  error: unknown;
  retry: () => void;
  full?: boolean;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <StatusScreen
      full={full}
      icon={<TriangleAlert aria-hidden />}
      title="화면을 불러오지 못했어요"
      description={
        <>
          잠시 후 다시 시도해 주세요. 계속 안 되면 문의해 주세요.
          {digest ? (
            <span className="mt-2 block font-mono text-xs text-faint">
              오류 번호 {digest}
            </span>
          ) : null}
        </>
      }
    >
      <button type="button" onClick={() => retry()} className={statusPrimaryAction}>
        다시 시도
      </button>
      <Link href="/" className={statusSecondaryAction}>
        홈으로
      </Link>
    </StatusScreen>
  );
}

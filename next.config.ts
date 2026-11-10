import type { NextConfig } from "next";

/**
 * 모든 응답에 붙이는 보안 헤더.
 *
 * - 다른 사이트가 이 앱을 iframe 에 넣어 버튼을 누르게 하는 것(클릭재킹)을 막는다
 * - 브라우저가 응답 종류를 추측해서 실행하지 않게 한다
 * - 다른 사이트로 나갈 때 주소 전체가 아니라 출처만 알려 준다
 *
 * HTTPS 강제(HSTS)는 Vercel 이 붙인다.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import "server-only";

import { headers } from "next/headers";

/** 메일에 넣는 링크의 앞부분. */
export async function appOrigin() {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // 운영에서는 요청의 Host 헤더로 링크를 만들지 않는다. APP_URL 을 빠뜨려도 Vercel 이
  // 알려 주는 운영 주소를 쓴다.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && production) return `https://${production}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

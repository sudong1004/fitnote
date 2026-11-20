import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

/**
 * Supabase 는 public 스키마의 테이블을 공개 키로 직접 읽고 쓰는 API 를 기본으로 연다.
 * 이 앱은 그 API 를 쓰지 않으므로 모든 테이블에 RLS 를 켜고 정책은 만들지 않는다.
 * 새 테이블을 추가하면서 RLS 를 켜지 않으면 건강 정보가 공개 키로 읽힐 수 있어 여기서 막는다.
 */
describe("행 수준 보안", () => {
  it("public 스키마의 모든 테이블에 RLS 가 켜져 있다", async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY c.relname
    `;

    expect(rows.map((row) => row.name)).toEqual([]);
  });
});

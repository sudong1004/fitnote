-- 모든 테이블의 행 수준 보안(RLS)을 켠다.
--
-- Supabase 는 public 스키마의 테이블을 공개 키(anon)로 직접 읽고 쓰는 API 를 기본으로 연다.
-- 이 앱은 그 API 를 쓰지 않고 서버가 Prisma 로만 DB 에 연결하므로(테이블 소유자라 RLS 를 거치지
-- 않는다), 정책을 하나도 만들지 않고 RLS 만 켜 두면 공개 키로는 아무것도 읽거나 쓸 수 없다.
-- 체중·체성분·식단 같은 건강 정보가 들어 있어서 꼭 필요하다.
--
-- 앞으로 테이블을 추가하는 마이그레이션도 같은 문장을 넣어야 한다
-- (tests/integration/rls.itest.ts 가 빠뜨리면 실패한다).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

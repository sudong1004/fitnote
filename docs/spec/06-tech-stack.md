# 06. 기술 스택 · 아키텍처

## 1. 기술 스택

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) | 서버 컴포넌트 + 서버 액션 중심. 화면과 서버가 한 저장소 |
| UI | React 19, Tailwind CSS v4 | 모바일 우선, 하단 탭 |
| 글꼴 | Pretendard (`pretendard` 패키지, dynamic-subset) | 외부 CDN 없이 앱과 같은 주소로 내보낸다 |
| 컴포넌트 | shadcn + `@base-ui/react`, `class-variance-authority`, `lucide-react` | 디자인 시스템 문서가 기준 |
| 언어 | TypeScript 5 | `strict`, `npm run typecheck` |
| 검증 | zod 4 | 입력 스키마. 서비스 계층에서 한국어 메시지로 거절 |
| DB | Supabase Postgres | 앱은 pgbouncer(6543), 마이그레이션은 직접 연결(5432) |
| ORM | Prisma 7 + `@prisma/adapter-pg` | 클라이언트는 `generated/prisma` 에 생성 |
| 인증 | 자체 구현: `jose`(JWT) + `bcryptjs` + `AuthSession` 테이블 | 쿠키 7일, 폐기 즉시 무효 |
| 사진 저장 | Supabase Storage (비공개 버킷) | 서버에서 service role 로 올리고 서명 주소로 노출 |
| 푸시 | Firebase Cloud Messaging (HTTP v1) + 웹 푸시 서비스 워커 | 홈 화면에 추가한 PWA 에서만 수신 |
| 이메일 | `nodemailer` + SMTP (가입 이메일 인증, 비밀번호 재설정) | 지금은 Gmail SMTP, 발송 한도 있음 |
| 배포 | Vercel (리전 `hnd1`, 도쿄) | 현재 Hobby 플랜. 유료화 전 Pro 로 |
| 정기 작업 | Vercel Cron `0 0 * * *` (UTC, 한국 09:00) | `/api/cron/reminders`, `CRON_SECRET` Bearer |
| 보안 헤더 | `next.config.ts` 의 `headers()` | `X-Frame-Options`·`frame-ancestors`, `nosniff`, `Referrer-Policy`. HSTS 는 Vercel |
| PWA | `app/manifest.ts`, 아이콘 3종, 서비스 워커 | 앱스토어 없이 홈 화면 추가 |
| CI | GitHub Actions | typecheck → lint → 단위 → 통합 → build, 별도 e2e 잡 |
| 테스트 | vitest 4, Playwright, `embedded-postgres` | 단위 · 통합(임시 Postgres) · E2E |
| Node / 패키지 | Node 24, npm 11 | 락파일은 `npx npm@10 install --package-lock-only` 로 맞춘다(npm 11 이 만든 락파일은 CI 의 `npm ci` 가 실패) |

## 2. 구조

```
app/                화면(라우트)과 서버 액션
  (auth) (legal) (user)   로그인·약관·회원 화면
  trainer/                트레이너 화면
  api/                    운동 API, 운동 목록, cron
  lib/                    세션(dal.ts, jwt.ts), 요청 제한, useSubmitKeep
components/         공용 컴포넌트 (ui = shadcn)
server/             도메인 서비스 — 규칙·검증·권한이 여기에 있다
  account body centers diet exercises journals journey
  notifications pt sharing trainers workouts
lib/                prisma, 메일, FCM, 저장소, 날짜 등 공통 도구
prisma/             schema.prisma, migrations(22개), seed
proxy.ts            낙관적 접근 보호 (쿠키만 확인)
tests/ e2e/         단위·통합 / E2E
docs/               PROGRESS.md, spec/
```

계층 규칙: **화면 → 서버 액션(`actions.ts`) → 서비스(`server/*`) → Prisma**. 권한과 입력 검사는 서비스에서 하고,
화면은 결과만 그린다. 서버 전용 모듈은 `server-only` 로 브라우저 번들에서 막는다.

## 3. 요청 흐름

1. 브라우저 → `proxy.ts`: 세션 쿠키가 없으면 로그인으로 (낙관적)
2. 서버 컴포넌트/레이아웃: `verifySession` → DB 의 `AuthSession` 으로 확인 (`cache` 로 한 요청에 한 번)
3. 서버 액션: `useSubmitKeep` 이 폼을 보내고, 서비스가 검증·권한 확인 후 Prisma 로 저장
4. 실패하면 한국어 안내(또는 `?error=코드`)로 돌아오고, 입력은 유지
5. 저장 후 알림이 필요하면 `Notification` 행 + FCM 푸시

## 4. 환경변수

| 이름 | 용도 | 필수 |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | 앱 연결(6543) / 마이그레이션(5432) | 필수 |
| `SESSION_SECRET` | 세션 JWT 서명 | 필수 |
| `SUPABASE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_PHOTO_BUCKET` | 사진 저장소. 서버 전용 | 선택(없으면 사진 비활성) |
| `FCM_PROJECT_ID` `FCM_CLIENT_EMAIL` `FCM_PRIVATE_KEY` | 푸시 발송 | 선택 |
| `NEXT_PUBLIC_FIREBASE_*` | 브라우저 푸시 설정 (공개 값) | 선택 |
| `APP_URL` | 푸시·메일 링크의 앞부분. 없으면 메일의 링크는 운영에서 Vercel 운영 주소, 그 밖에서는 요청 주소로 만든다 | 운영 필수 |
| `SMTP_USER` `SMTP_PASS` `SMTP_HOST` `SMTP_PORT` 또는 `RESEND_API_KEY`, `MAIL_FROM` | 가입 이메일 인증·비밀번호 재설정 메일. 둘 중 한 방식. 없으면 새로 가입할 수 없다 | 운영 필수 |
| `MAIL_OUTBOX_URL` | 자동 테스트 전용. 메일을 보내는 대신 이 주소(`http://localhost:…` 만 받음)로 넘긴다. `e2e/server.mjs` 가 넣는다 | 쓰지 않음 |
| `CRON_SECRET` | cron 호출 보호. 없으면 항상 401 | 필수(알림용) |

## 5. 외부 서비스

| 서비스 | 쓰는 곳 | 주의 |
| --- | --- | --- |
| Supabase | DB, 사진 저장소 | 무료 플랜은 비활성 시 일시정지 가능, 수동 백업 정책 필요 |
| Vercel | 호스팅, Cron | Hobby 는 상업적 사용 금지 → 과금 전 Pro |
| Firebase | 푸시 | |
| Gmail SMTP | 가입 인증·재설정 메일 | 가입할 때마다 메일이 나가므로 일일 한도(하루 약 500통)가 곧 하루 가입자 수 한도다. 정식 서비스 전 전용 발송 서비스로 교체 검토 |
| GitHub | 저장소, CI | |

## 6. 개발 규칙

- 브랜치: `trunk` 에서 작업 → `main` 에 `--no-ff` 병합 (병합 메시지 "Merge branch 'trunk' — …")
- 마이그레이션은 `prisma/migrations` 에 파일로 남기고, 운영 반영은 사람이 한다
- 화면을 바꾸면 디자인 시스템 문서(토큰·컴포넌트·화면 표)를 같은 작업에서 고친다
- 모든 입력 검사는 서비스 계층, 문구는 한국어
- 배포 전 확인: `npm run typecheck && npm run lint && npm test && npm run test:integration && npm run build`

## 7. 알려진 기술 부채

- 가입이 메일 발송에 달려 있다. Gmail SMTP 가 막히거나 한도를 넘으면 새 가입이 멈춘다(도메인 메일로 옮기기 전까지)
- 수동 백업 정책, 접근 로그(`DataAccessLog`) 없음
- 아이폰 Safari 실기기 검증은 사람이 함 (`05-test-scenarios.md` §7)

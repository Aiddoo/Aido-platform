# Aido

메모가 할 일이 되고, 친구와 함께 끝내는 투두 앱. NestJS API 서버와 Expo 모바일 앱, 둘이 공유하는 REST 계약을 하나의 pnpm + Turborepo 모노레포에서 관리한다.

## 목차

- [핵심 기능](#핵심-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [주요 명령어](#주요-명령어)
- [테스트 전략](#테스트-전략)
- [CI/CD](#cicd)
- [문서](#문서)
- [라이선스](#라이선스)

## 핵심 기능

- **할 일·메모**: 날짜·시간·리마인더가 있는 할 일, 반복 할 일, 카테고리, 메모를 할 일로 바꾸는 AI 파싱
- **친구와 함께**: 팔로우, 친구의 할 일 응원·찌르기(nudge), 할 일 댓글, 초대 링크
- **알림**: Expo Push 발송, receipt 확인, 사용자 시간대 기준 리마인더 스케줄링
- **기록·리포트**: 일일 완료와 주간 성취, AI 리포트
- **기타**: 날씨, 구독, 홈 화면 위젯(iOS/Android), 신고·차단, 문의

## 기술 스택

정확한 버전은 [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)의 catalog와 각 `package.json`을 따른다.

| 영역      | 기술                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| 서버      | NestJS 12.4.2 (ESM, SWC), Drizzle ORM 1.0.0-rc.5, PostgreSQL 16, pg-boss 12.38.1, AI SDK 7 (Google)                 |
| 공유 계약 | `@aido/api`: Zod 4.6.7 스키마·오류 코드·공용 vocabulary                                                             |
| 모바일    | Expo SDK 58.0.x, React Native 0.88, React 19.3, Expo Router, TanStack Query 5, HeroUI Native, Ky                    |
| 테스트    | Vitest 5 + Testcontainers(서버·계약), Jest 30 + jest-expo(모바일)                                                   |
| 툴링      | Node.js 26.13.0 LTS (EAS 빌드는 24.22.2), pnpm 12.15, Turborepo 2.11, TypeScript 6.0.3, Oxlint 1.93.0, Oxfmt 0.78.0 |
| 인프라    | Docker Compose, GitHub Actions, GHCR, AWS EC2, Expo EAS                                                             |

## 아키텍처

### 모노레포 구조

```text
.
├── apps/
│   ├── api/                  # @aido/server — NestJS REST API
│   │   ├── src/modules/      #   업무 Context (planning, social, notification, ...)
│   │   ├── src/platform/     #   DB·HTTP·job·cache 등 실행 기술
│   │   ├── src/shared/       #   Context 공통 순수 코드
│   │   ├── drizzle/          #   SQL 마이그레이션
│   │   └── test/             #   integration·e2e·architecture 테스트
│   └── mobile/               # @aido/mobile — Expo 앱 (src/features/* 기능 단위)
├── packages/
│   └── api/                  # @aido/api — 서버·모바일 공유 REST 계약
├── tooling/
│   ├── database-migrate/     # pg-boss + Drizzle 마이그레이션 CLI (migrate 이미지)
│   ├── typescript/           # tsconfig 프리셋
│   └── vitest/               # Vitest 프리셋
├── docs/                     # 공통 컨벤션·서버 문서
├── scripts/                  # CI 정책 스크립트, 배포 스크립트
└── docker-compose*.yml       # 로컬 DB / Docker 개발 / 운영 구성
```

### 서버 레이어

`src/modules/<context>`마다 Domain · Application · Infrastructure · Presentation 레이어를 둔 모듈러 모놀리스다. 의존은 안쪽(Domain)으로만 향하고, Infrastructure는 Application이 정의한 Port를 구현한다.

```mermaid
flowchart LR
  HTTP[HTTP 요청] --> P[Presentation<br/>Controller · Zod 검증]
  P --> U[Application<br/>UseCase]
  U --> D[Domain<br/>Aggregate · VO · Policy]
  U --> Port[Port<br/>consumer-owned interface]
  I[Infrastructure<br/>Drizzle · pg-boss · Redis · SDK] -. 구현 .-> Port
  I --> DB[(PostgreSQL)]
```

- Domain·Application은 Nest·ORM·vendor SDK에 의존하지 않는다. Nest Module이 Composition Root로서 UseCase와 Port 구현을 연결한다.
- Controller는 UseCase를 직접 호출한다. 다른 Context는 `*.public.ts`로 공개한 capability만 사용한다.
- 트랜잭션은 `UNIT_OF_WORK`와 CLS transaction(`@nestjs-cls/transactional`)으로 관리하고, 외부 발송은 커밋 이후에 실행한다.
- job은 PostgreSQL(pg-boss)만 쓴다. Redis는 `CACHE_TYPE=redis`·`PUSH_RATE_LIMIT_BACKEND=redis`를 고른 경우의 캐시·rate limit에만 쓴다.
- 앱 헤더(`X-App-Version`·`X-Timezone`·`X-Request-Id` 등)는 요청마다 한 번 `RequestClient`로 정규화한다. `X-Request-Id`는 응답으로 돌려주고 로그 `reqId`와 Sentry `request_id`가 된다.

상세: [apps/api/docs/architecture.md](./apps/api/docs/architecture.md)

### 서버·클라이언트 타입 공유

요청·응답 Zod 스키마와 오류 코드는 `@aido/api` 한 곳에서 정의한다. 서버 Presentation은 같은 스키마로 요청을 검증하고 Swagger 문서를 만들며, 모바일은 같은 스키마로 응답을 파싱하고 `z.infer` 타입을 쓴다. 두 앱 내부에 DTO를 다시 정의하지 않는다.

```text
packages/api (Zod 스키마, ErrorCode)
   ├──▶ apps/api     요청 검증 · OpenAPI 생성 · 오류 응답
   └──▶ apps/mobile  응답 파싱 · 타입 추론 · 오류 분기
```

`pnpm install`의 `postinstall`이 `packages/*`를 먼저 빌드하므로 설치 직후 두 앱에서 바로 import할 수 있다. 배포된 앱 버전과의 호환은 e2e의 OpenAPI·released-client fixture로 검증한다.

### 시간 규칙

| 값        | 저장·전송                               | 기준                                      |
| --------- | --------------------------------------- | ----------------------------------------- |
| 순간      | DB `timestamp(3)` UTC, API ISO datetime | 서버 process(`TZ=UTC`)와 DB 세션 모두 UTC |
| 달력 날짜 | DB `date`, API `YYYY-MM-DD`             | 사용자 시간대 기준의 날짜 key             |
| 시간대    | IANA 이름 (`Asia/Seoul`)                | 요청 헤더 `X-Timezone`, 사용자 설정       |

서버는 `X-Timezone`으로 사용자의 오늘·주·기간을 계산하고, 배치는 사용자별 저장 시간대를 쓴다. 상세: [docs/conventions/dates.md](./docs/conventions/dates.md)

## 빠른 시작

### 요구 사항

- Node.js `26.13.0` LTS ([`.nvmrc`](./.nvmrc))
- pnpm `12.15.0` (`packageManager`, `corepack enable`로 활성화)
- Docker (로컬 PostgreSQL·Redis, integration/e2e 테스트의 Testcontainers)

### 서버 실행

```sh
# 1. 의존성 설치 (packages/* 자동 빌드)
pnpm install

# 2. PostgreSQL 16(5432)·Redis(6379) 컨테이너 시작
pnpm docker:up

# 3. API 환경 파일 준비
cp .env.example apps/api/.env.development
#    예시의 DATABASE_URL은 Docker 개발 구성의 5433 포트다.
#    pnpm docker:up을 썼다면 postgresql://postgres:postgres@localhost:5432/aido 로 바꾼다.

# 4. pg-boss·Drizzle 마이그레이션 적용
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aido pnpm db:migrate

# 5. 개발 서버 (API + Expo Metro)
pnpm dev
```

- API: `http://localhost:8080`, Swagger UI: `http://localhost:8080/api/docs` (`NODE_ENV=development`에서만)
- 서버만 실행하려면 `pnpm --filter @aido/server dev`
- API까지 Docker로 실행하려면 `.env.docker.dev.example`을 `.env.docker.dev`로 복사하고 `pnpm docker:dev:up` (DB → migrate → API 순서로 기동)
- 모바일 환경 변수와 기기 실행은 [apps/mobile/README.md](./apps/mobile/README.md)를 따른다.

## 주요 명령어

루트에서 실행한다. 패키지 단위 명령은 `pnpm --filter <패키지> <명령>`을 쓴다.

| 명령어                  | 설명                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `pnpm dev`              | 전체 개발 서버 (`turbo run dev`)                           |
| `pnpm build`            | 전체 빌드                                                  |
| `pnpm typecheck`        | 전체 타입 검사                                             |
| `pnpm lint`             | Oxlint 정적 검사 (`lint:fix`로 자동 수정)                  |
| `pnpm format`           | Oxfmt 포맷 적용 (`format:check`로 검사만)                  |
| `pnpm check`            | lint + format:check + 이름·경계·관례 검사 + typecheck      |
| `pnpm lint:names`       | 서버 slice 폴더·파일 이름 검사 (ls-lint)                   |
| `pnpm test`             | 전체 unit 테스트                                           |
| `pnpm test:cov`         | unit 테스트 + 커버리지                                     |
| `pnpm test:integration` | 서버 PostgreSQL integration 테스트                         |
| `pnpm test:e2e`         | 서버 HTTP·계약 e2e 테스트                                  |
| `pnpm test:all`         | unit → integration → e2e                                   |
| `pnpm db:generate`      | Drizzle 스키마 변경으로 마이그레이션 SQL 생성              |
| `pnpm db:check`         | Drizzle 마이그레이션 정합성 검사                           |
| `pnpm db:migrate`       | pg-boss·Drizzle 마이그레이션 적용 (`DATABASE_URL` 필요)    |
| `pnpm docker:up`        | 로컬 PostgreSQL·Redis 시작 (`docker:down`으로 중지)        |
| `pnpm docker:dev:up`    | Docker 개발 환경(DB + migrate + API) 시작 (`docker:dev:*`) |
| `pnpm docker:prod:up`   | 운영 구성 로컬 시험 (`docker:prod:*`, `.env.docker.prod`)  |
| `pnpm commit`           | Conventional Commit 작성기 (commitizen)                    |
| `pnpm clean`            | 빌드 산출물과 `node_modules` 삭제                          |

## 테스트 전략

| 범위        | 위치·패턴                                           | 검증 대상                                                           |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| unit        | `apps/api/src/**/*.spec.ts`, `packages/api`, 모바일 | Domain 규칙, UseCase 분기, Adapter wire, 아키텍처 경계, 모바일 로직 |
| integration | `apps/api/test/integration/*.integration-spec.ts`   | 실제 PostgreSQL의 transaction·row lock·동시성·마이그레이션·job      |
| e2e         | `apps/api/test/e2e/*.e2e-spec.ts`                   | HTTP 검증·권한·응답, OpenAPI와 배포된 앱 버전의 계약 fixture        |

- **격리된 DB**: 실행마다 `aido_test_<run-id>` 템플릿 DB에 마이그레이션을 한 번 적용하고, worker 수만큼 복제한다. 각 worker는 자기 DB만 쓰고, 끝나면 자신이 만든 DB만 정리한다. 기본은 Testcontainers이고, `AIDO_TEST_POSTGRES_URL`을 주면 그 PostgreSQL을 쓴다. `DATABASE_URL`은 테스트 DB로 쓰지 않는다.
- **실행 방식**: unit은 worker 병렬(`maxWorkers: 50%`)이다. integration·e2e는 worker별 DB로 파일 단위 병렬(기본 2~4, `AIDO_TEST_DB_WORKERS`로 조정) + 무작위 순서(`sequence.shuffle`)로 실행해 순서 의존을 드러낸다. 테스트 사이 정리는 FK 트리거를 끈 `DELETE`로 처리한다.
- **외부 공급자**: Expo Push·Resend·AI SDK는 Fake 또는 고정 HTTP fixture로 격리한다. 실제 유료 호출(`ai:eval`)과 `test:performance`는 CI 밖에서 별도로 실행한다.

상세: [apps/api/docs/testing.md](./apps/api/docs/testing.md), [apps/mobile/.claude/testing-guide.md](./apps/mobile/.claude/testing-guide.md)

## CI/CD

```mermaid
flowchart LR
  Hook[로컬 lefthook<br/>unit · integration · 계약] --> PR[PR to main / main push]
  PR --> Gate[CI Scope<br/>변경 범위 계산]
  Gate --> Verify[Lint, Type Check & Build]
  Verify --> Img[Build & Push Image<br/>main 전용, GHCR]
  Img --> Deploy[Deploy to EC2<br/>SSH · migrate → API · health]
```

- **테스트**: GitHub Actions에서 돌리지 않는다. [lefthook](./lefthook.yml) pre-commit은 lint·format만 하고, pre-push가 단위 테스트·typecheck·build, 통합 테스트, 배포된 앱의 OpenAPI 계약 게이트(`test:contract`)를 실행한다. 전체 e2e는 로컬 `pnpm test:e2e`로 확인한다.
- **보안**: 워크플로 권한은 job 단위 최소 권한이고, 액션은 SHA로 고정한다. PR은 Dependency Review, main 이미지는 출처 증명(attestation)과 Trivy, 저장소는 CodeQL로 검사한다.
- **변경 범위**: `CI Scope` job이 diff로 API·모바일·공유 계약 범위를 계산해 필요한 job만 실행한다. 문서만 바뀌면 heavy job을 건너뛴다.
- **Stack PR**: 의존하는 PR은 같은 `stack:<release>` 라벨을 달고, 맨 위 tip 하나에만 `ci:stack-tip`을 단다. 중간 PR과 draft의 heavy job은 미루고, tip이 base와 모든 ancestor를 포함한 누적 diff를 한 번 검증한다. PR은 main을 향하고, 같은 Git tree가 main에 올라가면 tip 또는 일반 PR의 성공 결과를 재사용한다.
- **이미지**: main의 API 변경이 검증되면 ARM64 API·migrate 이미지를 같은 커밋 SHA 태그로 빌드하고, Trivy(HIGH/CRITICAL) 검사를 통과한 경우에만 GHCR에 push한다.
- **배포**: `Deploy to EC2` workflow가 두 이미지 태그를 확인한 뒤 SSH로 [`scripts/deploy.sh`](./scripts/deploy.sh)를 실행한다. **migrate 컨테이너가 먼저 실행되어** pg-boss·Drizzle 마이그레이션을 끝내야 API 컨테이너를 교체하며, health gate 실패 시 이전 API 이미지로 되돌린다.
- **모바일**: Expo EAS로 빌드·제출한다 ([apps/mobile/DEPLOYMENT.md](./apps/mobile/DEPLOYMENT.md)).

상세: [apps/api/docs/ci.md](./apps/api/docs/ci.md), [apps/api/docs/deployment.md](./apps/api/docs/deployment.md)

## 문서

| 주제                       | 문서                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 작업 진입점 (사람·AI 공통) | [AGENTS.md](./AGENTS.md), [apps/api/AGENTS.md](./apps/api/AGENTS.md), [apps/mobile/AGENTS.md](./apps/mobile/AGENTS.md)                                                                                            |
| 공통 컨벤션                | [오류](./docs/conventions/errors.md), [날짜·시간](./docs/conventions/dates.md), [하위 호환](./docs/conventions/compatibility.md), [null 비교](./docs/conventions/nullish.md), [Git·PR](./docs/conventions/git.md) |
| 서버 문서 안내             | [apps/api/docs/README.md](./apps/api/docs/README.md)                                                                                                                                                              |
| 서버 구조·코드 규칙        | [architecture](./apps/api/docs/architecture.md), [conventions](./apps/api/docs/conventions.md), [domain-modeling](./apps/api/docs/domain-modeling.md)                                                             |
| REST 계약·DB               | [http-contracts](./apps/api/docs/http-contracts.md), [persistence](./apps/api/docs/persistence.md)                                                                                                                |
| 테스트·로깅                | [testing](./apps/api/docs/testing.md), [observability](./apps/api/docs/observability.md)                                                                                                                          |
| 모바일 구조·UI             | [apps/mobile/.claude/](./apps/mobile/.claude/)                                                                                                                                                                    |
| 배포                       | [서버](./apps/api/docs/deployment.md), [모바일](./apps/mobile/DEPLOYMENT.md)                                                                                                                                      |

## 라이선스

[MIT](./LICENSE)

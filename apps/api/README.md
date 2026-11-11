# @aido/server

Aido의 NestJS REST API 서버다. 기술 스택, 레이어 구조, 테스트 전략, CI/CD 개요는 [루트 README](../../README.md)에 있다. 이 문서는 서버만 다룰 때 필요한 실행 방법과 참고 문서를 모은다.

## 시작하기

모노레포 루트에서 실행한다. 요구 사항은 [루트 README](../../README.md#시작하기)를 따른다.

```sh
pnpm install
pnpm docker:up                                  # PostgreSQL 5432, Redis 6379
cp .env.example apps/api/.env.development       # DATABASE_URL 포트를 5432로 맞춘다
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aido pnpm db:migrate
pnpm --filter @aido/server dev
```

- 서버는 `NODE_ENV`에 따라 `apps/api`의 `.env.development` · `.env`(production) · `.env.test`를 읽는다. 설정 스키마는 `src/platform/config/schemas`다.
- `pnpm db:migrate`는 [`tooling/database-migrate`](../../tooling/database-migrate/migrate.mjs)로 pg-boss 마이그레이션 후 Drizzle 마이그레이션(`drizzle/`)을 적용한다. 원격 DB는 `AIDO_ALLOW_REMOTE_DB=1` 없이 거부된다.
- API까지 Docker로 띄우려면 `.env.docker.dev.example`을 `.env.docker.dev`로 복사하고 `pnpm docker:dev:up`을 쓴다. 이 구성의 DB는 host 5433 포트다.

## 구조

```text
src/
├── modules/<context>/   # <slice>/{domain,application,infrastructure,presentation}
├── platform/            # DB transaction, HTTP filter, job, cache, 외부 호출 정책 등 실행 기술
├── shared/              # Context 공통 순수 규칙·Application 계약
└── bootstrap.ts         # 운영 진입점
drizzle/                 # SQL 마이그레이션
test/                    # fixtures · doubles · contracts · integration · e2e · performance
```

의존 방향은 HTTP → Presentation → UseCase → Domain/Port ← Infrastructure다. 상세 규칙은 [docs/architecture.md](./docs/architecture.md)에 있다. 새 slice는 루트에서 `pnpm gen:api-slice`로 만든다.

## 명령어

`pnpm --filter @aido/server <명령>`으로 실행한다. 안 쓰는 파일·export·의존성 검사(knip)는 루트 `pnpm check:unused`다.

| 명령               | 설명                                                |
| ------------------ | --------------------------------------------------- |
| `dev`              | watch 모드 개발 서버 (`nest start --watch`)         |
| `build`            | SWC 빌드 + 타입 검사 (`dist/`)                      |
| `typecheck`        | `tsc --noEmit`                                      |
| `lint:deps`        | dependency-cruiser 경계·순환 검사                   |
| `test`             | unit (`--project unit`), `test:cov`로 커버리지 포함 |
| `test:integration` | 실제 PostgreSQL integration (pre-push 훅)           |
| `test:e2e`         | HTTP 전체 e2e (로컬 전용, CI 제외)                  |
| `test:contract`    | 배포된 앱 OpenAPI 계약 게이트 (pre-push 훅)         |
| `test:performance` | 수동 성능 측정 (CI 밖)                              |
| `db:generate`      | Drizzle 스키마 변경으로 마이그레이션 SQL 생성       |
| `db:check`         | 마이그레이션 정합성 검사                            |
| `db:studio`        | Drizzle Studio                                      |
| `ai:eval`          | 실제 모델 호출 AI 평가 (유료, 승인된 경우만)        |

## API 문서

개발 도구가 켜진 로컬 실행(development + production 빌드가 아님, 테스트 실행 제외)에서만 등록된다. 배포된 개발서버는 열지 않는다([설정](docs/configuration.md#배포-환경)).

- Swagger UI: `http://localhost:8080/api/docs`, JSON: `/api/docs-json`
- 관리자 Swagger: `/api/admin/docs`

## 참고 문서

| 작업                 | 문서                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| 작업 경계·완료 기준  | [AGENTS.md](./AGENTS.md)                                                                     |
| 레이어·코드 규칙     | [architecture](./docs/architecture.md), [conventions](./docs/conventions.md)                 |
| REST 계약·구 앱 호환 | [http-contracts](./docs/http-contracts.md)                                                   |
| DB·마이그레이션      | [persistence](./docs/persistence.md)                                                         |
| 테스트               | [testing](./docs/testing.md)                                                                 |
| 로그·개인정보        | [observability](./docs/observability.md)                                                     |
| AI 업체·프롬프트     | [ai](./docs/ai.md)                                                                           |
| 푸시 알림 운영       | [push-notifications](./docs/push-notifications.md), [push-delivery](./docs/push-delivery.md) |
| 관리자 알림          | [admin-notifications](./docs/admin-notifications.md)                                         |
| 구독·결제 웹훅       | [billing](./docs/billing.md)                                                                 |
| CI·배포·롤백         | [CI](./docs/ci.md), [deployment](./docs/deployment.md)                                       |
| 전체 서버 문서 안내  | [docs/README.md](./docs/README.md)                                                           |

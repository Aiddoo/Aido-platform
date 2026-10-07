# @aido/server

NestJS REST API 서버다. 개발 시작은 이 문서, 코드 작업의 경계는 [AGENTS.md](./AGENTS.md), 운영 변경은 [배포 가이드](./DEPLOYMENT.md)에서 확인한다.

## 시작하기

모노레포 루트에서 실행한다. `.nvmrc`와 루트 `packageManager`에 지정된 Node.js와 pnpm을 사용한다.

```sh
pnpm install --frozen-lockfile
cp .env.example apps/api/.env.development
pnpm docker:up
pnpm --filter @aido/server db:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aido pnpm --filter @aido/server db:deploy
pnpm --filter @aido/server dev
```

`apps/api/.env.development`의 연결·인증 설정을 로컬 환경에 맞춘 뒤 실행한다. `db:generate`는 Git에서 제외된 native contract를 생성한다. `dev`는 이를 자동 생성하지 않으므로 최초 실행이나 계약 변경 뒤 필요하다. `db:deploy`는 pg-boss와 application graph를 적용하고 실제 schema를 검증한다. API까지 Docker로 실행하려면 `.env.docker.dev.example`을 `.env.docker.dev`로 복사하고 `pnpm docker:dev:up`을 사용한다.

## 구조와 참고 문서

```text
presentation → application → domain
                   ↑
             infrastructure → DB / cache / queue / vendor
```

Context는 `src/modules`, 공통 기술 구현은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. Composition Root가 순수 Application 클래스와 port 구현을 연결한다.

| 작업                 | 참고                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| API·Application 경계 | [.claude/architecture.md](./.claude/architecture.md), [.claude/api-conventions.md](./.claude/api-conventions.md) |
| DB·migration         | [.claude/prisma.md](./.claude/prisma.md)                                                                         |
| 테스트·CI            | [.claude/testing-guide.md](./.claude/testing-guide.md), [CI](../../docs/server/ci.md)                            |
| 푸시 운영            | [push-notifications.md](./docs/push-notifications.md)                                                            |
| 배포·롤백            | [DEPLOYMENT.md](./DEPLOYMENT.md)                                                                                 |
| 변경 이력·측정       | [migration.md](../../docs/server/migration.md), [Prisma 검증 기록](./docs/prisma8-verification.md)               |

## 현재 런타임

NestJS 12, TypeScript 6, Zod 4, Vitest 5와 PostgreSQL 16을 사용한다. Prisma ORM과 CLI는 서로 독립적인 RC 버전이다. 정확한 버전은 [API package.json](./package.json), [pnpm catalog](../../pnpm-workspace.yaml), [lockfile](../../pnpm-lock.yaml)을 따르며 RC 운영 전환 절차는 [Prisma 가이드](./.claude/prisma.md)에 둔다.

기본 job·push rate limit 저장소는 PostgreSQL/pg-boss다. Redis/BullMQ는 선택 backend와 기존 큐 drain 경로다. 외부 공급자는 Expo Push, Resend, AI SDK/Google이며 AI 모델은 `gemini-3.1-flash-lite`다. 설치 버전을 운영 배포 완료의 증거로 해석하지 않는다.

## API 문서와 명령

`NODE_ENV=development`에서 일반 Swagger는 `/api/docs`, JSON은 `/api/docs-json`, 관리자 Swagger는 `/api/admin/docs`다. 운영/test에서는 이 경로를 등록하지 않는다. HTTP·공개 스키마 정본은 presentation과 `packages/api`다.

API 명령은 `pnpm --filter @aido/server <명령>`으로 실행한다: `dev`, `build`, `typecheck`, `lint`, `format:check`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:deploy`. 변경에 필요한 검증 범위와 최종 CI 절차는 위 참고 문서에 둔다.

# Aido

> **Version**: 1.1.0 · **Last Updated**: 2026-08-14 · **Owner**: Aido Platform Team

메모가 할 일이 되고, 친구와 함께 끝내는 투두. Aido의 API 서버와 모바일 앱을
관리하는 Turborepo + pnpm 모노레포입니다.

## 목차

- [기술 스택](#기술-스택)
- [구조](#구조)
- [시작하기](#시작하기)
- [스크립트](#스크립트)
- [Docker 워크플로우](#docker-워크플로우)
- [패키지](#패키지)
- [개발 가이드](#개발-가이드)
- [API 문서](#api-문서)
- [배포](#배포)
- [라이선스](#라이선스)

## 기술 스택

| 분류         | 기술                                             |
| ------------ | ------------------------------------------------ |
| Monorepo     | Turborepo 2.11, pnpm 10.34                       |
| Backend      | NestJS 12 ESM, Prisma 8 RC, PostgreSQL 16        |
| Mobile       | Expo 58, React Native 0.88 RC, React 19.3        |
| Validation   | Zod 4.3.6, Nest Standard Schema                  |
| Testing      | Jest Expo 58 (Jest 29), Vitest 5, Testcontainers |
| Code Quality | Oxlint 1.86, Oxfmt 0.71                          |
| Runtime      | Node.js 24.21.0 LTS                              |

## 구조

```
aido/
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── mobile/       # Expo 모바일 앱
├── packages/
│   └── api/          # REST 계약·오류 코드·순수 공용 타입 (@aido/api)
├── tooling/
│   ├── typescript/   # TypeScript 프리셋
│   ├── vitest/       # Vitest 프리셋
│   └── database-migrate/ # 고정 lockfile 기반 migration CLI
└── turbo.json
```

## 시작하기

```bash
# 설치
pnpm install

# DB 실행 (Docker)
pnpm docker:up

# 마이그레이션
pnpm db:migrate

# 개발 서버
pnpm dev
```

## 스크립트

### 개발

| 명령어              | 설명                  |
| ------------------- | --------------------- |
| `pnpm dev`          | 전체 개발 서버        |
| `pnpm build`        | 전체 빌드             |
| `pnpm typecheck`    | 타입 검사             |
| `pnpm lint`         | Oxlint 정적 검사      |
| `pnpm format`       | 코드 포맷팅           |
| `pnpm format:check` | Oxfmt 포맷 검사       |
| `pnpm clean`        | 빌드 산출물 전체 삭제 |

### 데이터베이스

| 명령어             | 설명                |
| ------------------ | ------------------- |
| `pnpm db:migrate`  | Prisma 마이그레이션 |
| `pnpm db:generate` | Prisma Client 생성  |
| `pnpm db:push`     | 스키마 즉시 반영    |

### 테스트

| 명령어          | 설명                                   |
| --------------- | -------------------------------------- |
| `pnpm test`     | 단위 테스트                            |
| `pnpm test:e2e` | E2E 테스트                             |
| `pnpm test:all` | 전체 테스트 (Unit + Integration + E2E) |
| `pnpm test:cov` | 커버리지 리포트                        |

### Docker

| 명령어                  | 설명                               |
| ----------------------- | ---------------------------------- |
| `pnpm docker:up`        | DB 컨테이너 (로컬 개발)            |
| `pnpm docker:down`      | DB 컨테이너 중지                   |
| `pnpm docker:dev:up`    | 개발 환경 전체 (DB + API)          |
| `pnpm docker:dev:down`  | 개발 환경 중지                     |
| `pnpm docker:prod:up`   | 프로덕션 환경 (DB + Migrate + API) |
| `pnpm docker:prod:down` | 프로덕션 환경 중지                 |

## Docker 워크플로우

| 모드        | Compose 파일              | 용도                 |
| ----------- | ------------------------- | -------------------- |
| DB Only     | `docker-compose.yml`      | 로컬 개발 (추천)     |
| Development | `docker-compose.dev.yml`  | Docker 전체 개발     |
| Production  | `docker-compose.prod.yml` | 프로덕션 배포 테스트 |

- **DB Only**: PostgreSQL만 Docker로 실행하고 API는 로컬에서 `pnpm dev`로 실행
- **Development**: DB + API를 모두 Docker로 실행 (`.env.docker.dev` 필요)
- **Production**: 프로덕션 이미지 빌드 + 자동 마이그레이션 (`.env.docker.prod` 필요)

## 패키지

| 패키지                             | 설명              |
| ---------------------------------- | ----------------- |
| [@aido/server](./apps/api)         | NestJS 백엔드 API |
| [@aido/mobile](./apps/mobile)      | Expo 모바일 앱    |
| [@aido/api](./packages/api)        | Zod 스키마        |
| [@aido/api/errors](./packages/api) | 에러 정의         |

## 개발 가이드

- **커밋**: Conventional Commits (`pnpm commit`)
- **린트/포맷**: Oxlint + Oxfmt (`pnpm lint && pnpm format:check`)
- **타입**: TypeScript strict 모드
- **DTO**: Zod 스키마 (`@aido/api`)
- **에러 코드**: `@aido/api/errors`의 `ErrorCode` 사용 (하드코딩 금지)
- **AI 에이전트 워크플로우**: [AGENTS.md](./AGENTS.md) 참조

## API 문서

- Swagger UI: `http://localhost:8080/api-docs`
- OpenAPI JSON: `http://localhost:8080/api-docs-json`

## 배포

- **API**: AWS EC2 + Docker Compose (GitHub Actions SSH 배포). [apps/api/DEPLOYMENT.md](./apps/api/DEPLOYMENT.md)
- **Mobile**: Expo EAS 빌드. [apps/mobile/DEPLOYMENT.md](./apps/mobile/DEPLOYMENT.md)

## 라이선스

MIT

1.10.0 변경과 검증 현황은 [클라이언트 Before/After](apps/mobile/docs/releases/1.10.0-client.md)와 [검증 기록](docs/releases/1.10.0-verification.json)을 참고하세요.

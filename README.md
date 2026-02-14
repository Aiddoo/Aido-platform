# Aido

AI 기반 할 일 관리 애플리케이션. Turborepo + pnpm 모노레포.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Monorepo | Turborepo 2.7, pnpm 9.15 |
| Backend | NestJS 11, Prisma 7, PostgreSQL 16 |
| Mobile | Expo 54, React Native 0.81, React 19.1 |
| Validation | Zod 4.3, nestjs-zod |
| Testing | Jest 29, Vitest, Testcontainers |
| Code Quality | Biome 2.3 |

## 구조

```
aido/
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── mobile/       # Expo 모바일 앱
├── packages/
│   ├── validators/   # Zod 스키마 (@aido/validators)
│   ├── utils/        # 유틸리티 (@aido/utils)
│   └── errors/       # 에러 정의 (@aido/errors)
├── tooling/
│   ├── typescript/   # TypeScript 프리셋
│   ├── jest/         # Jest 프리셋
│   ├── vitest/       # Vitest 프리셋
│   └── biome/        # Biome 프리셋
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

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 전체 개발 서버 |
| `pnpm build` | 전체 빌드 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm lint` | Biome 린트 |
| `pnpm format` | 코드 포맷팅 |
| `pnpm clean` | 빌드 산출물 전체 삭제 |

### 데이터베이스

| 명령어 | 설명 |
|--------|------|
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm db:generate` | Prisma Client 생성 |
| `pnpm db:push` | 스키마 즉시 반영 |

### 테스트

| 명령어 | 설명 |
|--------|------|
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm test:all` | 전체 테스트 (Unit + Integration + E2E) |
| `pnpm test:cov` | 커버리지 리포트 |

### Docker

| 명령어 | 설명 |
|--------|------|
| `pnpm docker:up` | DB 컨테이너 (로컬 개발) |
| `pnpm docker:down` | DB 컨테이너 중지 |
| `pnpm docker:dev:up` | 개발 환경 전체 (DB + API) |
| `pnpm docker:dev:down` | 개발 환경 중지 |
| `pnpm docker:prod:up` | 프로덕션 환경 (DB + Migrate + API) |
| `pnpm docker:prod:down` | 프로덕션 환경 중지 |

## Docker 워크플로우

| 모드 | Compose 파일 | 용도 |
|------|-------------|------|
| DB Only | `docker-compose.yml` | 로컬 개발 (추천) |
| Development | `docker-compose.dev.yml` | Docker 전체 개발 |
| Production | `docker-compose.prod.yml` | 프로덕션 배포 테스트 |

- **DB Only**: PostgreSQL만 Docker로 실행하고 API는 로컬에서 `pnpm dev`로 실행
- **Development**: DB + API를 모두 Docker로 실행 (`.env.docker.dev` 필요)
- **Production**: 프로덕션 이미지 빌드 + 자동 마이그레이션 (`.env.docker.prod` 필요)

## 패키지

| 패키지 | 설명 |
|--------|------|
| [@aido/api](./apps/api) | NestJS 백엔드 API |
| [@aido/mobile](./apps/mobile) | Expo 모바일 앱 |
| [@aido/validators](./packages/validators) | Zod 스키마 |
| [@aido/utils](./packages/utils) | 유틸리티 함수 |
| [@aido/errors](./packages/errors) | 에러 정의 |

## 개발 가이드

- **커밋**: Conventional Commits (`pnpm commit`)
- **린트/포맷**: Biome
- **타입**: TypeScript strict 모드
- **DTO**: Zod 스키마 (@aido/validators)

## API 문서

```
http://localhost:8080/api/docs
```

## 배포

프로덕션 배포는 AWS ECS + ECR 기반. 상세 가이드는 [API 배포 문서](./apps/api/DEPLOYMENT.md)를 참고.

## 라이선스

MIT

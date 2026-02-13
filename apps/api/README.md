# @aido/api

NestJS 11 기반 RESTful API 서버. Prisma 7 + PostgreSQL.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | NestJS 11 |
| ORM | Prisma 7 + @prisma/adapter-pg |
| Database | PostgreSQL 16 |
| Validation | Zod + nestjs-zod |
| Documentation | Swagger/OpenAPI |
| Logging | Pino |
| Testing | Jest, Testcontainers |

## 구조

```
src/
├── common/           # 공통 모듈
│   ├── database/     # DB 유틸리티
│   ├── date/         # 날짜/타임존 유틸리티
│   ├── decorators/   # 커스텀 데코레이터 (@Timezone 등)
│   ├── exception/    # 예외 처리
│   ├── logger/       # 로깅
│   ├── pagination/   # 페이지네이션
│   ├── response/     # 응답 표준화
│   └── swagger/      # Swagger 설정
├── config/           # 환경 설정
├── database/         # Prisma 서비스
└── modules/          # 도메인 모듈
```

## 아키텍처

```
Controller → Service → Repository → Database
```

## 시작하기

```bash
# 루트에서 의존성 설치
pnpm install

# API 로컬 실행
pnpm --filter @aido/api db:migrate
pnpm --filter @aido/api dev
```

## Docker 실행 (개발)

```bash
# apps/api 디렉토리에서
cp .env.docker.development.example .env.docker.development

pnpm docker:dev:up
pnpm docker:dev:logs
pnpm docker:dev:down
```

개발용 구성:
- `docker-compose.dev.yml`
- `NODE_ENV=development`
- 로컬 Postgres(`aido_dev`) 포함
- 앱 시작 전 `prisma migrate deploy` 자동 실행

## Docker 실행 (운영)

```bash
# apps/api 디렉토리에서
cp .env.docker.production.example .env.docker.production
# 실제 운영 값으로 .env.docker.production 수정

pnpm docker:prod:build
pnpm docker:prod:up
pnpm docker:prod:logs
pnpm docker:prod:down
```

운영용 구성:
- `docker-compose.prod.yml`
- `NODE_ENV=production`
- `migrate` 서비스가 먼저 실행되어 마이그레이션 적용 후 API 기동
- DB는 외부 관리형(PostgreSQL) 연결을 기본 가정

## 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 URL |
| `PORT` | 서버 포트 (기본: 8080) |
| `JWT_SECRET` | JWT 서명 키 |
| `JWT_EXPIRES_IN` | 토큰 만료 (기본: 15m) |

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 (watch) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm test:integration` | 통합 테스트 |
| `pnpm db:migrate` | 마이그레이션 |
| `pnpm db:studio` | Prisma Studio |

## API 문서

### Swagger UI
- **개발 환경**: http://localhost:8080/api-docs
- **OpenAPI JSON**: http://localhost:8080/api-docs-json

### 클라이언트 가이드
- [📱 알림 구현 가이드](./docs/PUSH_NOTIFICATION_GUIDE.md)

## 배포

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md) 참고.

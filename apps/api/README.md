# @aido/api

NestJS 11 기반 RESTful API 서버. Prisma 7 + PostgreSQL.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | NestJS 11 |
| ORM | Prisma 7 |
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
# 루트에서
pnpm install
pnpm docker:up
pnpm db:migrate

# API 개발 서버
pnpm --filter @aido/api dev
```

## 환경 변수

`.env.example` → `.env` 복사 후 설정

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
- [📱 알림 구현 가이드](./docs/NOTIFICATION_GUIDE.md)

## 배포

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md) 참고.

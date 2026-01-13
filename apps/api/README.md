# @aido/api

> Aido 백엔드 API 서버

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E.svg)
![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 개요

NestJS 11 기반의 RESTful API 서버입니다. Prisma 7 ORM을 사용하여 PostgreSQL 데이터베이스와 통신하며, 모듈화된 아키텍처로 확장성과 유지보수성을 보장합니다.

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| Framework | NestJS 11 |
| ORM | Prisma 7 |
| Database | PostgreSQL 16 |
| Validation | Zod + nestjs-zod |
| Documentation | Swagger/OpenAPI |
| Logging | Pino (nestjs-pino) |
| Security | Helmet, Rate Limiting |
| Testing | Jest, Testcontainers |

## 프로젝트 구조

```
src/
├── common/                 # 공통 모듈
│   ├── database/          # 데이터베이스 유틸리티
│   ├── exception/         # 예외 처리 (필터, 서비스)
│   ├── logger/            # Pino 로깅 모듈
│   ├── pagination/        # 페이지네이션 유틸리티
│   ├── response/          # 응답 변환 인터셉터
│   ├── request/           # 요청 유틸리티
│   └── swagger/           # Swagger 데코레이터/스키마
├── config/                 # 환경 설정 및 검증
├── database/               # Prisma 서비스 모듈
├── generated/              # Prisma Client 생성 파일
├── modules/                # 기능 모듈
│   ├── health/            # 헬스체크 엔드포인트
│   └── todo/              # Todo CRUD
├── app.module.ts          # 루트 모듈
├── app.controller.ts      # 루트 컨트롤러
├── app.service.ts         # 루트 서비스
└── main.ts                # 애플리케이션 진입점
```

## 아키텍처

### 3계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                    Controllers                          │
│              (요청 처리, 응답 변환)                      │
├─────────────────────────────────────────────────────────┤
│                     Services                            │
│              (비즈니스 로직 처리)                        │
├─────────────────────────────────────────────────────────┤
│                   Repositories                          │
│              (데이터 액세스 계층)                        │
└─────────────────────────────────────────────────────────┘
```

### 핵심 모듈

| 모듈 | 설명 |
|------|------|
| `DatabaseModule` | Prisma Client 인스턴스 관리 |
| `LoggerModule` | 구조화된 로깅 (Pino) |
| `ExceptionModule` | 전역 예외 필터 |
| `ResponseModule` | 응답 표준화 인터셉터 |
| `PaginationModule` | 커서/오프셋 페이지네이션 |
| `ThrottlerModule` | Rate Limiting (100 req/min) |

## 시작하기

### 사전 요구사항

- Node.js >= 20.0.0
- pnpm >= 9.15.0
- PostgreSQL 16+ (또는 Docker)

### 설치 및 실행

```bash
# 루트에서 의존성 설치
pnpm install

# 데이터베이스 실행 (Docker)
pnpm docker:up

# 마이그레이션 적용
pnpm db:migrate

# 개발 서버 실행
pnpm --filter @aido/api dev
```

### 환경 변수

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aido?schema=public"

# Server
PORT=4000
NODE_ENV=development

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

## API 문서

개발 서버 실행 후 Swagger UI에서 API 문서를 확인할 수 있습니다:

```
http://localhost:4000/api/docs
```

### 주요 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/api/todos` | Todo 목록 조회 |
| POST | `/api/todos` | Todo 생성 |
| GET | `/api/todos/:id` | Todo 상세 조회 |
| PATCH | `/api/todos/:id` | Todo 수정 |
| DELETE | `/api/todos/:id` | Todo 삭제 |

## 스크립트

```bash
# 개발
pnpm dev              # 개발 서버 (watch 모드)
pnpm build            # 프로덕션 빌드
pnpm start            # 프로덕션 서버

# 테스트
pnpm test             # 단위 테스트
pnpm test:watch       # 테스트 (watch 모드)
pnpm test:cov         # 커버리지 포함 테스트
pnpm test:e2e         # E2E 테스트
pnpm test:integration # 통합 테스트 (Testcontainers)

# 데이터베이스
pnpm db:generate      # Prisma Client 생성
pnpm db:push          # 스키마 푸시 (개발용)
pnpm db:migrate       # 마이그레이션 실행
pnpm db:studio        # Prisma Studio 실행

# 코드 품질
pnpm check            # Biome 린트
pnpm format           # Biome 포맷
pnpm typecheck        # TypeScript 타입 체크
```

## 테스트

### 단위 테스트

```bash
pnpm test
```

### 통합 테스트 (Testcontainers)

실제 PostgreSQL 컨테이너를 사용한 통합 테스트:

```bash
pnpm test:integration
```

## 보안

### 적용된 보안 기능

- **Helmet**: HTTP 보안 헤더 설정
- **Rate Limiting**: 분당 100회 요청 제한
- **CORS**: Cross-Origin 요청 제어
- **환경 변수 검증**: Zod 스키마 기반 검증

## 로깅

Pino 기반 구조화된 로깅:

- **개발**: Pretty print 포맷, debug 레벨
- **프로덕션**: JSON 포맷, info 레벨

```typescript
// 로거 사용 예시
@Injectable()
export class TodoService {
  constructor(private readonly logger: LoggerService) {}

  async create(dto: CreateTodoDto) {
    this.logger.log('Creating todo', { dto });
    // ...
  }
}
```

## 변경 이력

### v0.0.1 (2025-01-13)

- 초기 릴리즈
- NestJS 11 기반 API 서버 구축
- Prisma 7 ORM 통합
- Todo CRUD API 구현
- 헬스체크 엔드포인트
- Swagger/OpenAPI 문서화
- Pino 로깅 시스템
- Rate Limiting 및 보안 미들웨어
- Testcontainers 통합 테스트

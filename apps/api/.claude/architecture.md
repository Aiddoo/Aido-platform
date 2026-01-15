# API 아키텍처 가이드

> NestJS 기반 백엔드 API의 전체 아키텍처 개요

## 관련 문서

| 문서 | 내용 |
|------|------|
| [validators.md](./validators.md) | @aido/validators 패키지 규칙 (Zod 스키마, NestJS DTO) |
| [api-conventions.md](./api-conventions.md) | Controller/Service/Repository 계층 규칙 |
| [prisma.md](./prisma.md) | Prisma 7 가이드 (스키마, 마이그레이션, 트랜잭션) |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 (supertest, Testcontainers) |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 (Jest, Mock) |
| [integration-test.md](./integration-test.md) | 통합 테스트 가이드 (TestDatabase) |

---

## 개요

| 항목 | 값 |
|------|-----|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 7.2.0 |
| 데이터베이스 | PostgreSQL |
| 검증 | Zod 4.3 + nestjs-zod |
| 문서화 | Swagger (OpenAPI) |

---

## 아키텍처 개요

```
HTTP Request
     ↓
┌─────────────────────────────────────────────────────────┐
│  Controller                                             │
│  - HTTP 요청/응답 처리                                  │
│  - DTO 검증 (Zod + nestjs-zod)                          │
│  - Swagger 문서화                                       │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  Service                                                │
│  - 비즈니스 로직                                        │
│  - 예외 처리 (NotFoundException 등)                     │
│  - 트랜잭션 관리                                        │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  Repository                                             │
│  - 데이터 액세스                                        │
│  - Prisma 쿼리 캡슐화                                   │
└─────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────┐
│  DatabaseService (Prisma)                               │
│  - PostgreSQL 연결                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조

```
apps/api/
├── prisma/
│   ├── schema.prisma        # 데이터베이스 스키마
│   └── migrations/          # 마이그레이션 파일
├── src/
│   ├── main.ts              # 애플리케이션 진입점
│   ├── app.module.ts        # 루트 모듈
│   ├── common/              # 공통 모듈
│   │   ├── config/          # 환경설정
│   │   ├── database/        # DatabaseService
│   │   ├── exception/       # 예외 처리
│   │   ├── logger/          # 로깅
│   │   ├── pagination/      # 페이지네이션
│   │   └── swagger/         # Swagger 설정
│   └── modules/             # 도메인 모듈
│       ├── auth/            # 인증 모듈
│       ├── todo/            # Todo 모듈
│       └── email/           # 이메일 모듈
└── test/
    ├── e2e/                 # E2E 테스트
    ├── integration/         # 통합 테스트
    ├── mocks/               # 테스트 Mock
    └── setup/               # 테스트 설정
```

---

## 계층별 책임

### Controller

- HTTP 요청 수신 및 응답 반환
- DTO 기반 입력 검증
- Swagger 문서화
- Service 호출

**상세**: [api-conventions.md - Controller 규칙](./api-conventions.md#controller-규칙)

### Service

- 비즈니스 로직 구현
- Repository를 통한 데이터 액세스
- 예외 발생 (NotFoundException 등)
- 트랜잭션 관리

**상세**: [api-conventions.md - Service 규칙](./api-conventions.md#service-규칙)

### Repository

- Prisma 쿼리 캡슐화
- 단일 엔티티 책임
- 트랜잭션 클라이언트 지원

**상세**: [api-conventions.md - Repository 규칙](./api-conventions.md#repository-규칙)

---

## DTO 흐름

```
@aido/validators                    apps/api
┌─────────────────┐                ┌─────────────────┐
│ Zod Schema      │ ───build───>  │ NestJS DTO      │
│ (domains/)      │                │ (nestjs/)       │
└─────────────────┘                └─────────────────┘
        │                                  │
        │                                  │
        ▼                                  ▼
┌─────────────────┐                ┌─────────────────┐
│ Type Export     │                │ Controller      │
│ z.infer<>       │                │ @Body() dto     │
└─────────────────┘                └─────────────────┘
```

**상세**: [validators.md](./validators.md)

---

## 공통 모듈

### ResponseTransformInterceptor

모든 성공 응답 자동 래핑:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GlobalExceptionFilter

모든 에러 응답 자동 래핑:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### PaginationService

```typescript
// 오프셋 기반
const params = this.paginationService.normalizePagination({ page: 1, size: 20 });
// → { page: 1, size: 20, skip: 0, take: 20 }
```

### ConfigService

환경변수 타입-안전 접근:

```typescript
const jwtSecret = this.configService.get('jwt.secret');
const dbUrl = this.configService.get('database.url');
```

---

## 새 기능 추가 워크플로우

### 1. @aido/validators에 스키마 추가

```bash
# packages/validators/src/domains/{name}/
├── {name}.constants.ts
├── {name}.request.ts
├── {name}.response.ts
└── index.ts

# packages/validators/src/nestjs/domains/{name}/
├── {name}.request.dto.ts
├── {name}.response.dto.ts
└── index.ts

pnpm build
```

**상세**: [validators.md - 새 도메인 추가 체크리스트](./validators.md#새-도메인-추가-체크리스트)

### 2. Prisma 모델 추가

```bash
# prisma/schema.prisma에 모델 추가
pnpm prisma:migrate
```

**상세**: [prisma.md](./prisma.md)

### 3. API 모듈 구현

```bash
# src/modules/{name}/
├── {name}.module.ts
├── {name}.controller.ts
├── services/
│   └── {name}.service.ts
└── repositories/
    └── {name}.repository.ts

# app.module.ts에 import 추가
```

**상세**: [api-conventions.md - 새 모듈 추가 체크리스트](./api-conventions.md#새-모듈-추가-체크리스트)

### 4. 테스트 작성

```bash
# 단위 테스트
src/modules/{name}/services/{name}.service.spec.ts
src/modules/{name}/repositories/{name}.repository.spec.ts

# E2E 테스트
test/e2e/{name}.e2e-spec.ts

# 통합 테스트 (필요시)
test/integration/{name}.integration-spec.ts
```

**상세**: [e2e-test.md](./e2e-test.md), [unit-test.md](./unit-test.md)

---

## 의존성 주입 규칙

```
Controller
    │
    └──> Service
            │
            ├──> Repository (주 데이터 액세스)
            │        │
            │        └──> DatabaseService
            │
            ├──> 다른 Service (필요시)
            │
            └──> DatabaseService (트랜잭션용으로만)
```

### 허용

- Controller → Service
- Service → Repository
- Service → 다른 Service
- Service → DatabaseService (트랜잭션용)
- Repository → DatabaseService

### 금지

- Controller → Repository (Service 거쳐야 함)
- Controller → DatabaseService
- Repository → 다른 Repository
- Repository → Service

---

## 환경 구성

> **상세**: [api-conventions.md - 개발 환경 설정](./api-conventions.md#개발-환경-설정)

### 개발 환경

```bash
pnpm docker:up    # PostgreSQL 컨테이너 (먼저 실행!)
pnpm dev          # 전체 개발 서버
pnpm dev:api      # API만 실행
```

### 테스트

```bash
pnpm test         # 단위 테스트
pnpm test:e2e     # E2E 테스트 (Testcontainers)
pnpm test:cov     # 커버리지 리포트
```

### 빌드

```bash
pnpm build        # 전체 빌드
pnpm typecheck    # 타입 체크
pnpm lint         # Biome 린트
```

# Aido API

NestJS 기반 백엔드 API. 3계층 아키텍처 + Event-Driven 알림.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 7 |
| 데이터베이스 | PostgreSQL |
| 검증 | Zod 4.3 + nestjs-zod |
| 이벤트 | EventEmitter2 |
| 캐시 | Memory / Redis (Strategy) |
| 암호화 | AES-256-GCM |
| 문서화 | Swagger (OpenAPI) |
| 테스트 | Jest + @suites/unit + Testcontainers |

---

## 아키텍처 레이어

```
Request → Guard → Controller → Service → Repository → DB
                                   ↓
                            EventEmitter2 → Listener → PushProvider
```

---

## 핵심 규칙

- **예외**: `BusinessExceptions.xxx()` 팩토리 메서드 사용 (`new HttpException()` 금지)
- **트랜잭션**: `database.$transaction(tx => ...)`, Repository 메서드는 `tx?` 파라미터 필수
- **이벤트**: 알림/부수효과는 `eventEmitter.emit()` + `satisfies` 타입 체크
- **암호화**: OAuth 토큰 등 민감 데이터는 `EncryptionService`로 암호화 저장
- **중복 방지**: 크론 작업은 DB 기반 (in-memory Set/Map 금지)
- **응답 래핑**: 자동 (`ResponseTransformInterceptor` / `GlobalExceptionFilter`)
- **타임존**: 서버는 UTC 저장, 클라이언트 `X-Timezone` 헤더로 날짜 경계 판단

---

## 문서 가이드

| 상황 | 읽을 문서 |
|------|----------|
| 전체 아키텍처 이해 (에러, 이벤트, 보안, 공통 모듈) | [.claude/architecture.md](.claude/architecture.md) |
| Controller/Service/Repository 코드 작성 | [.claude/api-conventions.md](.claude/api-conventions.md) |
| Zod 스키마/DTO 추가 | [.claude/validators.md](.claude/validators.md) |
| Prisma 스키마/마이그레이션 | [.claude/prisma.md](.claude/prisma.md) |
| 테스트 작성 (종합) | [.claude/testing-guide.md](.claude/testing-guide.md) |
| 단위 테스트 | [.claude/unit-test.md](.claude/unit-test.md) |
| E2E 테스트 | [.claude/e2e-test.md](.claude/e2e-test.md) |
| 통합 테스트 | [.claude/integration-test.md](.claude/integration-test.md) |
| 로깅 패턴 | [.claude/logging-guide.md](.claude/logging-guide.md) |

---

## 빠른 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 (전체) |
| `pnpm dev:api` | API만 실행 |
| `pnpm docker:up` | PostgreSQL 컨테이너 시작 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm typecheck` | 타입 체크 |
| `pnpm lint` | Biome 린트 |
| `pnpm prisma:migrate` | DB 마이그레이션 |
| `pnpm build` | 전체 빌드 |

---

## 새 기능 추가 순서

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm prisma:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Repository** → `tx?` 패턴, EncryptionService (민감 데이터)
4. **Service** → BusinessExceptions, 트랜잭션, 이벤트 발행
5. **Controller** → Swagger 문서화, DTO 검증
6. **Module** → `app.module.ts`에 등록
7. **테스트** → Unit → Integration → E2E

> 상세 체크리스트: [architecture.md - 새 기능 추가 체크리스트](.claude/architecture.md#8-새-기능-추가-체크리스트)

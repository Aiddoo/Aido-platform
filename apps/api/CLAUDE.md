# Aido API

> **Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Platform Team

NestJS 기반 백엔드 API. 3계층 아키텍처(레거시) + 클린아키텍처·CQRS(신규 표준, todo부터) + BullMQ 큐 기반 알림.

---

## 문서 가이드

| 상황 | 읽을 문서 |
|------|----------|
| 전체 아키텍처 이해 (에러, BullMQ 큐, 보안, 공통 모듈) | [.claude/architecture.md](.claude/architecture.md) |
| Controller/Service/Repository 코드 작성 | [.claude/api-conventions.md](.claude/api-conventions.md) |
| 클린아키텍처(CQRS) 모듈 작성 (todo 표준) | [.claude/api-conventions.md §9](.claude/api-conventions.md#9-클린아키텍처cqrs-모듈-규칙) → [architecture.md §1.4](.claude/architecture.md) |
| Zod 스키마/DTO 추가 | [.claude/validators.md](.claude/validators.md) |
| Prisma 스키마/마이그레이션 | [.claude/prisma.md](.claude/prisma.md) |
| 테스트 작성 (종합) | [.claude/testing-guide.md](.claude/testing-guide.md) |
| 단위 테스트 | [.claude/unit-test.md](.claude/unit-test.md) |
| 통합 테스트 | [.claude/integration-test.md](.claude/integration-test.md) |
| E2E 테스트 | [.claude/e2e-test.md](.claude/e2e-test.md) |
| 로깅 패턴 | [.claude/logging-guide.md](.claude/logging-guide.md) |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 7 |
| 데이터베이스 | PostgreSQL |
| 검증 | Zod 4.3 + nestjs-zod |
| 큐 | BullMQ (Redis) |
| 캐시 | Memory / Redis (Strategy) |
| 암호화 | AES-256-GCM |
| 문서화 | Swagger (OpenAPI) |
| 테스트 | Jest + @suites/unit + Testcontainers |

---

## 아키텍처 레이어

```
[레거시 3계층]
Request → Guard → Controller → Service → Repository → DB
                                   ↓
                            QueueService → BullMQ → Processor → PushProvider

[클린아키텍처+CQRS — todo 모듈, 신규 표준]
Request → Guard → Controller → CommandBus/QueryBus → Handler(use-case)
                                   ↓ 포트(인터페이스)          ↓ 도메인 이벤트(커밋 후)
                              Adapter → Repository → DB    @EventsHandler → 부수효과
```

---

## 핵심 규칙

- **예외**: 레거시는 `BusinessExceptions.xxx()` 팩토리, 클린아키 모듈은 `ApplicationException`/`DomainException` (`new HttpException()` 금지)
- **트랜잭션**: 레거시는 `database.$transaction(tx => ...)`, 클린아키 모듈은 `TRANSACTION_MANAGER.run(tx => ...)`. Repository 메서드는 `tx?` 파라미터 필수
- **타입 단언 금지**: 클린아키 영역(domain/application/infrastructure)은 `as`/`!` 금지 — `pnpm lint:no-cast` CI 강제
- **API 계약 고정**: `openapi-contract.e2e-spec` 스냅샷 diff 0 = 클라이언트 영향 0 (리팩터링 게이트)
- **큐**: 알림/부수효과는 `QueueService.enqueueXxx()` fire-and-forget 패턴 (트랜잭션 커밋 후 enqueue)
- **암호화**: OAuth 토큰 등 민감 데이터는 `EncryptionService`로 암호화 저장
- **중복 방지**: 크론 작업은 DB 기반 (in-memory Set/Map 금지)
- **응답 래핑**: 자동 (`ResponseTransformInterceptor` / `GlobalExceptionFilter`)
- **타임존**: 서버는 UTC 저장, 클라이언트 `X-Timezone` 헤더로 날짜 경계 판단

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
| `pnpm db:migrate` | DB 마이그레이션 |
| `pnpm build` | 전체 빌드 |

---

## 새 기능 추가 순서

**클린아키텍처 모듈(todo 등 전환 완료 모듈)에 기능 추가:**

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm db:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Domain** → 애그리게잇 행동 메서드/VO/이벤트 (불변식은 DomainException)
4. **Application** → 포트 확장 + `use-cases/<kebab>/` 커맨드·핸들러(+spec)
5. **Infrastructure** → 어댑터에 포트 구현 (레거시 Repository 위임)
6. **Controller** → CommandBus 디스패치, Swagger 문서화
7. **Module** → 배럴(CommandHandlers 등) 자동 등록 확인
8. **테스트** → 핸들러 spec → e2e (openapi 스냅샷 diff 0 확인)

**레거시 3계층 모듈에 기능 추가:**

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm db:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Repository** → `tx?` 패턴, EncryptionService (민감 데이터)
4. **Service** → BusinessExceptions, 트랜잭션, QueueService enqueue
5. **Controller** → Swagger 문서화, DTO 검증
6. **Module** → `app.module.ts`에 등록
7. **테스트** → Unit → Integration → E2E

> 상세 체크리스트: [architecture.md - 새 기능 추가 체크리스트](.claude/architecture.md#8-새-기능-추가-체크리스트)

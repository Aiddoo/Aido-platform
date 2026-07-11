# Aido API

> **Version**: 1.1.0 · **Last Updated**: 2026-07-11 · **Owner**: Aido Platform Team

NestJS 기반 백엔드 API. 클린아키텍처 use-case 표준(전 모듈, 참조 구현: **todo**) + BullMQ 큐 기반 알림. 레거시 3계층은 **auth만** 잔존(클린아키 마이그레이션 진행 중).

---

## 문서 가이드

| 상황 | 읽을 문서 |
|------|----------|
| 전체 아키텍처 이해 (에러, BullMQ 큐, 보안, 공통 모듈) | [.claude/architecture.md](.claude/architecture.md) |
| Controller/Service/Repository 코드 작성 | [.claude/api-conventions.md](.claude/api-conventions.md) |
| 클린아키텍처 모듈 작성 (use-case 표준 — todo 참조) | [.claude/api-conventions.md §9](.claude/api-conventions.md#9-클린아키텍처-모듈-규칙) → [architecture.md §1.4](.claude/architecture.md) |
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
[클린아키텍처 use-case 표준 — 전 모듈 기본 경로. 참조 구현: todo. @nestjs/cqrs 미사용]
Request → Guard → Controller → Facade → UseCase(execute)
                                   ↓ 포트(인터페이스)          ↓ 도메인 이벤트(커밋 후)
                              Adapter → Repository → DB    DOMAIN_EVENT_PUBLISHER
                                                            → EventEmitter2 → @OnEvent 핸들러(부수효과)

[레거시 3계층 — auth 한정, 마이그레이션 진행 중]
Request → Guard → Controller → Service → Repository → DB
                                   ↓
                            QueueService → BullMQ → Processor → PushProvider
```

---

## 핵심 규칙

- **예외**: 레거시는 `BusinessExceptions.xxx()` 팩토리, 클린아키 모듈은 `ApplicationException`/`DomainException` (`new HttpException()` 금지)
- **트랜잭션**: 클린아키 모듈은 `UNIT_OF_WORK.run(async () => ...)` — 콜백 무인자, 리포지토리가 CLS에서 활성 TX를 읽음. 레거시(auth)는 `database.$transaction(tx => ...)` + Repository `tx?` 파라미터
- **타입 단언 금지**: 클린아키 영역(domain/application/infrastructure)은 `as`/`!` 금지 — `pnpm lint:no-cast`로 검사 (수동 게이트, CI 미연결)
- **임포트 경계**: 클린아키 모듈의 레이어 의존성 방향은 `pnpm lint:boundaries`로 검사 (수동 게이트) — domain은 프레임워크·DB 금지, application은 Prisma 타입·타 모듈 내부 금지, 외부는 배럴만
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

**클린아키텍처 모듈(auth 제외 전 모듈 — 기본 경로)에 기능 추가:**

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm db:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Domain** → 애그리게잇 행동 메서드/자식 엔티티/VO/정책 함수/이벤트 (불변식은 DomainException, 생성은 planCreation, 판단 규칙은 domain/services/ 정책)
4. **Application** → 포트 확장 + 쓰기는 `use-cases/<kebab>/<kebab>.use-case.ts`, 읽기는 `queries/<kebab>/<kebab>.use-case.ts` (+spec) — `@Injectable()` 클래스, 단일 `execute(input)`
5. **Infrastructure** → 어댑터에 포트 구현 (레거시 Repository 위임)
6. **Facade/Controller** → Facade에 한 줄 위임 메서드 추가, 컨트롤러는 Facade 호출 + Swagger 문서화
7. **Module** → 배럴(`XxxUseCases`/`XxxQueryUseCases` 배열) 자동 등록 확인
8. **테스트** → use-case spec → e2e (openapi 스냅샷 diff 0 확인) + `lint:no-cast`·`lint:boundaries` 통과

**레거시 3계층(auth 한정)에 기능 추가:**

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm db:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Repository** → `tx?` 패턴, EncryptionService (민감 데이터)
4. **Service** → BusinessExceptions, 트랜잭션, QueueService enqueue
5. **Controller** → Swagger 문서화, DTO 검증
6. **Module** → `app.module.ts`에 등록
7. **테스트** → Unit → Integration → E2E

> 상세 체크리스트: [architecture.md - 새 기능 추가 체크리스트](.claude/architecture.md#8-새-기능-추가-체크리스트)

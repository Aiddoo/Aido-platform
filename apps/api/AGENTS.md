# Aido API

> **Version**: 1.2.0 · **Last Updated**: 2026-07-23 · **Owner**: Aido Platform Team

NestJS 기반 백엔드 API. **전 모듈 클린아키텍처 use-case 표준**(참조 구현: **todo**) + BullMQ 큐 기반 알림. @nestjs/cqrs 미사용(버스 없는 `@Injectable` use-case).

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
[클린아키텍처 use-case 표준 — 전 모듈. 참조 구현: todo. @nestjs/cqrs 미사용]
Request → Guard → Controller → Facade → UseCase(execute)
                                   ↓ 포트(인터페이스)          ↓ 도메인 이벤트(커밋 후)
                              Adapter → Repository → DB    DOMAIN_EVENT_PUBLISHER
                                                            → EventEmitter2 → @OnEvent 핸들러(부수효과)

[내구성 부수효과 — 커밋 후 enqueue]
UseCase/Adapter → QueueService.enqueueXxx() → BullMQ → Processor → PushProvider/외부 I/O
```

---

## 핵심 규칙

- **예외**: 모듈 코드는 `ApplicationException`/`DomainException`(둘 다 `ErrorCodedException`, `ErrorCode` 보유)을 던진다. `GlobalExceptionFilter`가 이를 정규화해 HTTP 응답을 만든다. `BusinessException`/`BusinessExceptions`는 필터의 canonical 에러 타입 + 공유 에러 카탈로그(Prisma P2002 매핑 등)이며 신규 비즈니스 로직에서 직접 던지지 않는다. `new HttpException()` 금지
- **트랜잭션**: `UNIT_OF_WORK.run(async () => ...)` — 콜백 무인자, 리포지토리가 CLS(`TransactionHost.tx`)에서 활성 TX를 읽는다
- **타입 단언 금지**: 클린아키 영역(domain/application/infrastructure)은 `as`/`!` 금지 — `as`는 `pnpm lint:no-cast`, `!`는 Biome `noNonNullAssertion`(biome.json override)로 검사 (CI `lint:arch` 게이트)
- **임포트 경계**: 클린아키 모듈의 레이어 의존성 방향은 `pnpm lint:boundaries`(dependency-cruiser, `.dependency-cruiser.cjs`)로 검사 (CI `lint:arch` 게이트) — domain은 프레임워크·DB 금지, application은 Prisma 타입·타 모듈 내부 금지, 외부는 배럴만
- **API 계약 고정**: `openapi-contract.e2e-spec`의 현재 스냅샷 + 스토어 배포 클라이언트 fingerprint가 기존 request/response/status/Zod shape를 고정한다. 새 route/schema 추가만 허용 (상시 계약 게이트 — CI e2e에서 실행)
- **큐**: 알림/부수효과는 `QueueService.enqueueXxx()` fire-and-forget 패턴 (트랜잭션 커밋 후 enqueue)
- **캐시**: application은 **모듈 캐시 포트**(Symbol 토큰)에만 의존 — 공유 `CacheService`/`CacheKeys` 직접 주입 금지(`.dependency-cruiser.cjs`가 강제). 상세: [architecture.md §5.3.2](.claude/architecture.md)
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

**클린아키텍처 모듈(전 모듈)에 기능 추가:**

1. **Prisma 스키마** → `prisma/schema.prisma` + `pnpm db:migrate`
2. **Validators** → `@aido/validators`에 Zod 스키마 + NestJS DTO + `pnpm build`
3. **Domain** → 애그리게잇 행동 메서드/자식 엔티티/VO/정책 함수/이벤트 (불변식은 DomainException, 생성은 planCreation, 판단 규칙은 domain/services/ 정책)
4. **Application** → 포트 확장 + 쓰기는 `use-cases/<kebab>/<kebab>.use-case.ts`, 읽기는 `queries/<kebab>/<kebab>.use-case.ts` (+spec) — `@Injectable()` 클래스, 단일 `execute(input)`
5. **Infrastructure** → 어댑터에 포트 구현 (Prisma 저장소·벤더 SDK·BullMQ 등)
6. **Facade/Controller** → Facade에 한 줄 위임 메서드 추가, 컨트롤러는 Facade 호출 + Swagger 문서화
7. **Module** → 배럴(`XxxUseCases`/`XxxQueryUseCases` 배열) 자동 등록 확인
8. **테스트** → use-case spec → e2e (openapi 스냅샷 diff 0 확인) + `lint:no-cast`·`lint:boundaries` 통과

> 상세 체크리스트: [architecture.md - 새 기능 추가 체크리스트](.claude/architecture.md#8-새-기능-추가-체크리스트)

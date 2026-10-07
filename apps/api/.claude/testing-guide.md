# Aido API 종합 테스팅 가이드

**Version**: 1.1.0 · **Last Updated**: 2026-10-01 · **Owner**: Aido Platform Team

> 테스트 유형 선택 기준 + 공유 인프라 + 공통 규칙. 각 유형별 상세는 개별 가이드 참조.

## 관련 문서

| 문서                                         | 내용                                        |
| -------------------------------------------- | ------------------------------------------- |
| [unit-test.md](./unit-test.md)               | 단위 테스트 상세 (typed mock, fixture, GWT) |
| [integration-test.md](./integration-test.md) | 통합 테스트 상세 (Mock DB, 실제 DB)         |
| [e2e-test.md](./e2e-test.md)                 | E2E 테스트 상세 (createE2eApp, supertest)   |

---

## 1. 테스트 피라미드

```
        /\
       /E2E\        적은 수, 느림, 실제 환경
      /------\
     /Integ- \      중간, NestJS DI 검증
    / ration  \
   /------------\
  /    Unit      \  많은 수, 빠름, 격리됨
 /----------------\
```

| 유형        | 파일 패턴               | 목적                                   | 상세 가이드                                  |
| ----------- | ----------------------- | -------------------------------------- | -------------------------------------------- |
| Unit        | `*.spec.ts`             | 개별 클래스/메서드 동작 검증           | [unit-test.md](./unit-test.md)               |
| Integration | `*.integration-spec.ts` | Service + Repository DI / DB 스택 검증 | [integration-test.md](./integration-test.md) |
| E2E         | `*.e2e-spec.ts`         | 전체 API 흐름 검증                     | [e2e-test.md](./e2e-test.md)                 |

---

## 2. 유형 선택 기준

| 검증하려는 것                           | 유형                  | 이유                                     |
| --------------------------------------- | --------------------- | ---------------------------------------- |
| 단일 메서드의 입력 검증 / 예외 분기     | Unit                  | 직접 생성 + typed mock으로 격리          |
| Repository 쿼리 파라미터                | Unit                  | `toHaveBeenCalledWith`로 충분            |
| NestJS DI 연결 정합성                   | Integration (Mock DB) | 실제 DI 컨테이너 구동 필요               |
| `UNIT_OF_WORK.run` 다중 Repository 조합 | Integration (Mock DB) | 트랜잭션 콜백 통합 검증                  |
| 실제 DB 쿼리 + 마이그레이션 정합성      | Integration (실제 DB) | 공식 CI PG service / 로컬 Testcontainers |
| HTTP 요청 → 응답 전체 흐름              | E2E                   | supertest + 인증 + DB                    |
| Guard / Interceptor 동작                | E2E                   | 실제 HTTP 파이프라인 필요                |

---

## 3. 파일 구조

```text
apps/api/
├── src/modules/<context>/
│   ├── domain/{aggregates,entities,value-objects,policies}/<slice>/*.spec.ts
│   ├── application/use-cases/<slice>/*.use-case.spec.ts
│   └── infrastructure/{persistence,adapters,jobs,subscribers}/<slice>/*.spec.ts
└── test/
    ├── e2e/*.e2e-spec.ts
    ├── integration/*.integration-spec.ts
    ├── builders/
    ├── fixtures/
    ├── mocks/ports/
    └── setup/
```

### 3.1 Application spec

순수 Application은 `mockDeep<ConstructorParameters<typeof UseCase>[0]>()`로 의존성을 준비하고
직접 생성한다. 콜백을 실행하는 UoW fixture 등 기존 업무 fixture를 주입하고 시나리오별 반환값만
설정한다. Nest DI가 필요한 Infrastructure/Presentation은 기존 Suites를 사용한다.
[Unit 가이드](./unit-test.md)에 실제 코드 형식을 정리했다.

- 이벤트는 공개 `publishAll`에 전달되는 domain event로 검증한다. protected state에 spy하지 않는다.
- `createUnitOfWorkMock()`은 CLS 기반 무인자 콜백을 실행한다. rollback은 실제 PG 테스트에서 검증한다.
- 영속 상태는 Aggregate/VO의 `reconstitute()`로 복원한다. 조회 결과는 기존 Builder를 재사용한다.
- Module과 worker harness는 운영 Composition Root의 Application factory provider를 재사용한다.

### 3.2 동작 동일성 게이트 (마이그레이션 필수)

| 게이트                           | 파일                                               | 검증 내용                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenAPI 계약 스냅샷**          | `test/e2e/openapi-contract.e2e-spec.ts`            | 전체 라우트·요청/응답 스키마 스냅샷 — **diff 0은 공개 명세 동일성의 근거이며 모든 운영 영향의 보장은 아님**. 의도적 계약 변경 시에만 `-u`로 재생성                        |
| **스토어 배포 계약 fingerprint** | `test/e2e/fixtures/released-*-openapi-contract.ts` | 배포된 1.7.x(111 paths·137 schemas), 1.8.2(113 paths·140 schemas) 계약을 각각 고정. 문서 문구와 새 API 추가는 허용하되 기존 request/response/status/Zod shape 변경은 차단 |
| **블랙박스 E2E**                 | `test/e2e/todo.e2e-spec.ts` 등                     | 리팩터링 시 **무수정 통과**가 원칙 — 테스트를 고치면 동일성 증명이 깨진다                                                                                                 |

---

## 4. 공유 인프라

### 4.1 핵심 인프라

| 파일                                                   | 용도                                                                        | 사용처                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------- |
| `test/setup/suppress-logger.ts`                        | `suppressLogger()` — Logger 출력 억제                                       | Integration                 |
| `test/mocks/mock-database.factory.ts`                  | `createMockDatabaseService()` — native ORM context 연결                     | Integration (Mock DB)       |
| `test/e2e/helpers/e2e-app-factory.ts`                  | `createE2eApp()` / `destroyE2eApp()`                                        | E2E                         |
| `test/e2e/helpers/e2e-helpers.ts`                      | `E2eHelpers` — `createVerifiedUser()` 등                                    | E2E                         |
| `test/setup/managed-test-database.ts`                  | Vitest 실행당 공식 CI PG service / 로컬 Testcontainers + migration 수명주기 | Integration (실제 DB) + E2E |
| `test/setup/test-database.ts`                          | 관리형 테스트 DB의 Prisma 연결 + 안전한 truncate                            | Integration (실제 DB) + E2E |
| `test/integration/helpers/auth-test-module.factory.ts` | `createAuthTestModule()`                                                    | Integration (실제 DB, Auth) |

### 4.2 FakeService 목록

| 파일                                   | 대체 대상           |
| -------------------------------------- | ------------------- |
| `fake-email.service.ts`                | 이메일 발송         |
| `fake-oauth-token-verifier.service.ts` | OAuth 토큰 검증     |
| `fake-admin-notifier.ts`               | Discord 관리자 알림 |
| `fake-ai.provider.ts`                  | Gemini AI           |
| `fake-push.provider.ts`                | Expo 푸시 알림      |
| `fake-logger.service.ts`               | Pino Logger         |

### 4.3 Builder vs Fixture 선택 기준

| 상황                         | 선택    | 예시                                      |
| ---------------------------- | ------- | ----------------------------------------- |
| 단일 엔티티 mock 반환값      | Builder | `UserBuilder.create().verified().build()` |
| 도메인 상태가 중요한 테스트  | Builder | `.locked()`, `.expired()`, `.asPremium()` |
| DB에 실제 삽입할 복합 데이터 | Fixture | `UserFixture.createFull()`                |

---

## 5. 공통 규칙

### DO

- ✅ 테스트 이름과 준비·실행·검증 순서로 의도 표현. 주석은 동시성 보장이나 계약상 제약처럼 코드만으로 드러나지 않는 이유에 사용
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ 한국어 describe/it 설명 + 유형 태그 (예: `"(Mock DB)"`, `"(실제 DB)"`)
- ✅ `clearMocks`/`restoreMocks`는 `vitest.config.ts`에서 매 테스트 전에 적용된다. Fixture ID 리셋도 setup의 `beforeEach`가 소유한다
- ✅ FakeService로 외부 서비스 대체 (E2E)

### DON'T

- ❌ Unit 테스트에서 실제 DB 연결
- ❌ Integration 테스트에서 HTTP 요청
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID 사용 (Builder 사용)
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)

> 유형별 DO/DON'T 상세는 각 개별 가이드 참조.

### 전역 설정 참고

`vitest.config.ts`의 `clearMocks: true`, `restoreMocks: true`가 매 테스트 전에 적용된다. `vi.spyOn()`과 `suppressLogger()`는 `beforeEach`에서 생성한다. `beforeAll`에서 만든 spy는 첫 테스트 전에 복원되므로 사용하지 않는다. Fixture ID와 fake 상태는 setup의 `beforeEach`에서 초기화한다.

---

## 6. 실행 명령어

```bash
# Unit
pnpm --filter @aido/server test                     # 전체
pnpm --filter @aido/server test {파일명}             # 특정 파일
pnpm --filter @aido/server test:watch               # Watch 모드
pnpm --filter @aido/server test:cov                 # 커버리지

# Integration
pnpm --filter @aido/server test:integration         # 전체

# E2E
pnpm --filter @aido/server test:e2e                 # 전체
pnpm --filter @aido/server test:e2e -- {파일명}      # 특정 파일
pnpm --filter @aido/server test:e2e -- -t "패턴"    # 특정 테스트
```

---

## 7. 예제 파일 경로

| 유형                     | 예제 파일                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Unit (쓰기 use-case)** | `src/modules/planning/application/use-cases/todos/update-todo.use-case.spec.ts` — UoW·이벤트·포트 팩토리 |
| Unit (읽기 query)        | `src/modules/planning/application/use-cases/todos/get-todo-summary.use-case.spec.ts`                     |
| Integration (Mock DB)    | `test/integration/cheer.integration-spec.ts`                                                             |
| Integration (실제 DB)    | `test/integration/auth-password-setup.integration-spec.ts`                                               |
| E2E                      | `test/e2e/todo.e2e-spec.ts`                                                                              |
| Builder                  | `test/builders/user.builder.ts`                                                                          |
| FakeService              | `test/mocks/fake-*.ts`                                                                                   |

---

**문서 버전**: 4.0.0
**최종 수정일**: 2026-10-01

## ESM과 격리

- API는 NodeNext ESM이다. 내부 별칭은 `#api/*`, 테스트 별칭은 `#test/*`, 상대 경로에는 `.js`를 명시한다. `require`와 `__dirname`은 사용하지 않는다.
- Unit, integration, E2E는 Vitest project로 나눈다. DB project는 파일을 직렬 실행하고 순서를 섞어 공유 상태 의존을 확인한다.
- DB global setup은 `AIDO_TEST_POSTGRES_URL`이 있으면 공식 PostgreSQL service 안에 실행별 DB를 생성하고, 없으면 로컬 Testcontainers를 사용한다. 각 실행에 migration을 적용한다. `provide`/`inject`로 연결 정보를 worker에 전달하며, 자신이 만든 DB/컨테이너의 종료는 global setup의 반환 teardown이 소유한다.
- SDK mock은 `vi.hoisted`와 `vi.mock`을 사용한다. 실제 오류 클래스, 토큰 검증, 순수 SDK 함수는 `importOriginal`로 유지한다. Constructor mock의 구현은 일반 함수나 class를 사용한다.
- Prisma query의 select 결과는 필요한 반환 필드를 명시한다. `asMock`의 partial mock 지원은 native ORM projection이 선택한 필드만 돌려주는 테스트에서 사용한다.
- 동시성 테스트는 transaction barrier와 PostgreSQL lock 상태를 관찰한다. 한 번의 event loop tick이나 임의 sleep으로 순서를 가정하지 않는다.
- E2E throttle은 해당 TestingModule의 provider override로만 격리한다. 전역 prototype이나 다른 suite의 guard를 변경하지 않는다.
- E2E reset이 실패하면 같은 환경의 후속 테스트도 차단한다. timeout은 작업을 취소하지 못하므로 오염된 환경을 재사용하지 않는다. 종료는 앱/Redis/cache를 먼저 정리한 뒤 Prisma 연결을 닫는다.

## 순서 의존 검증

실패를 재현할 때 seed를 로그와 PR 검증 기록에 남깁니다. 동일 프로젝트의 DB 파일은 직렬 실행하며, 독립된 프로세스로 반복할 때는 각 실행이 자체 관리형 DB를 소유합니다.

```bash
pnpm --filter @aido/server exec vitest run --project unit --sequence.shuffle --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project integration --sequence.shuffle --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project e2e --sequence.shuffle --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project integration \
  test/integration/push-delivery-outbox.integration-spec.ts \
  test/integration/mutation-lock-concurrency.integration-spec.ts \
  --sequence.shuffle --sequence.seed=1001
```

릴리스 전에는 전체 프로젝트를 서로 다른 seed로 반복하고, outbox 및 mutation lock 테스트는 실제 PostgreSQL에서 별도로 반복합니다. 통과 횟수, 테스트 수, seed, 실행 시간과 실패 여부를 기록하며, 병렬 빌드나 캐시 조건이 다른 수치로 성능 향상률을 주장하지 않습니다.

# 서버 테스트

무엇을 어느 층에서 테스트할지, 어떻게 격리해 돌릴지 정할 때 읽는다. 공통 테스트 규칙(새 테스트는 중요한 로직에만, GWT 한 줄, 한국어 제목, stub 우선)은 [루트 AGENTS](../../../AGENTS.md#공통-코드-규칙)에 있다. AI 평가는 [AI](ai.md#평가)에 있다.

## 원칙

행동 하나를, 그것을 증명할 수 있는 가장 싼 층에서, 한 번만 테스트한다. 개수나 커버리지를 목표로 하지 않는다.

| 쓴다                                                                           | 층                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Entity·VO 불변식, 상태 전이(바뀜·안 바뀜), 도메인 서비스 판정                  | Unit(순수)                                                            |
| UseCase 업무 분기: 권한·한도·멱등·오류 우선순위·부수효과 순서·건너뜀           | Unit + InMemory 포트·`FixedClock`                                     |
| SQL 의미: keyset 순서, 잠금·원자 claim·rollback, constraint·충돌, 마이그레이션 | Integration(실제 PostgreSQL) + 포트 계약 suite                        |
| 출시 앱 계약: route·status·validation·envelope·OpenAPI 지문·구 헤더            | E2E + released fixture                                                |
| 외부 공급자 wire: 요청 모양·오류 분류·schema 거절                              | Unit(`globalThis.fetch` spy + 같은 `*.wire.ts` schema)                |
| 날짜 경계                                                                      | Unit([날짜 규칙](../../../docs/conventions/dates.md#4-테스트할-경계)) |

**쓰지 않는다**: 전달만 하는 Controller·UseCase, provider 조립(E2E 부팅이 증명), 필드 복사 매퍼, 상수, private 메서드, 로그 문구(개인정보 비노출만 예외), mock 호출 횟수(호출 자체가 계약일 때만 예외), 구현을 복사한 기대값.

## 구조

```text
test/
  fixtures/<context>/<noun>.fixture.ts        # create<Noun>Fixture(overrides), DB seed는 insert<Noun>FixtureRows(db)
  doubles/<context>/in-memory-<noun>.repository.ts | fake-<capability>.ts | stub-<capability>.ts
  doubles/platform/                           # fixed-clock, immediate-unit-of-work, recording-mutation-lock,
                                              # recording-after-commit-registry, in-memory-job-queue, silent-logger …
  contracts/platform/cache-store.contract.ts
  contracts/<context>/<noun>-repository.contract.ts
  integration/<context>/<slice>/*.integration-spec.ts
  e2e/*.e2e-spec.ts, e2e/fixtures/released-*-openapi-contract.ts (불변)
  setup/                                      # global-setup, managed-test-database, test-database
```

- 새 필드는 fixture 기본값 한곳에 더하고 시나리오에서는 차이만 덮어쓴다.
- 포트 계약 suite(`describe<Noun>RepositoryContract(createRepository)`)를 InMemory(unit, `*.repository.port.spec.ts`)와 Drizzle(integration)이 같이 통과한다. 사례: [memo 계약](../test/contracts/notes/memo-repository.contract.ts)을 [unit](../src/modules/notes/memos/application/ports/memo.repository.port.spec.ts)·[integration](../test/integration/notes/memos/drizzle-memo.repository.integration-spec.ts)에서 돌린다.
- UseCase spec은 파일 안의 작은 factory(`createCreateMemoUseCase({ memoRepository })`)로 기본 더블(`ImmediateUnitOfWork`·`RecordingMutationLock`·`FixedClock`·`SilentLogger`)을 두고 다른 부분만 덮어쓴다. 사례: [create-memo spec](../src/modules/notes/memos/application/use-cases/create-memo.use-case.spec.ts).
- 테스트 더블은 손으로 쓴 InMemory·Fake·Stub·Recording이다. Nest가 주는 실제 객체(`ExecutionContextHost`, `TransactionHost`)가 있으면 그것을 쓴다. mock 라이브러리(`vitest-mock-extended`·`@suites/*`)와 깊은 mock을 쓰지 않는다. 실패를 주입하거나 호출 자체가 계약일 때도 작은 기록용 double(`RecordingOperationalAlert`·`RecordingMutationLock`)로 본다.
- `pnpm gen:api-slice`가 fixture·InMemory 저장소·계약·integration spec 뼈대를 함께 만든다.

```ts
describe("CreateMemoUseCase — 메모 만들기", () => {
  it("한도에 도달하면 빈 내용보다 MEMO_2003을 먼저 던지고 저장하지 않는다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository(
      Array.from({ length: MEMO_LIMITS.MAX_PER_USER }, (_, index) =>
        createMemoFixture({ id: index + 1, sortOrder: index }),
      ),
    );
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, content: "" });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2003 });
    expect(memoRepository.size).toBe(MEMO_LIMITS.MAX_PER_USER);
  });
});
```

## 알림·시간 엣지 케이스 (최소 목록)

| 케이스                                                                               | 층                         |
| ------------------------------------------------------------------------------------ | -------------------------- |
| 방해 금지 경계: 현지 20:59/21:00/07:59/08:00 × 서울·LA, DST 전환일                   | Unit(`isWithinQuietHours`) |
| 야간 광고 동의 있음/없음/`force`                                                     | Unit                       |
| 기기 0대·권한 미요청·거부·토큰 없음·90일 stale → 알림함은 생성, 푸시는 사유와 건너뜀 | Unit + Integration         |
| `DeviceNotRegistered` receipt → 토큰 비활성화와 기록이 한 트랜잭션                   | Integration                |
| 수신 언어: 저장 ko/en, 없음, 지원 안 함(`ja`), 카탈로그 키 누락은 컴파일 오류        | Unit + parity spec         |
| 다국어 캠페인: ko만 입력·둘 다 입력                                                  | Unit + Integration         |
| 수신자 현지 시각 발송: 서울·LA 10:00의 `startAfter`, 지난 시각이면 다음 날           | Unit                       |
| 같은 캠페인 재시도·같은 `requestId` 재요청 → 중복 발송 없음                          | Integration                |
| 우선순위 차선: 마케팅이 쌓여도 리마인더 worker가 먼저 가져감                         | Integration                |
| 해외 이동: 재예약, 울린 단계 재발송 없음, 서울↔도쿄 재예약 0                         | Integration                |
| 미국 사용자 "오늘"·일간 한도 초기화                                                  | Unit                       |

## 시간과 타이머

- 시각은 `FixedClock`으로 고정한다. 옛 구조 코드의 Date 판단만 `vi.useFakeTimers({ toFake: ["Date"] })`로 Date만 바꾸고 `afterEach`에 복원한다.
- PostgreSQL·socket·job의 native timer는 그대로 둔다. 완료는 [실행 자원과 flake](#실행-자원과-flake)대로 기다린다.
- 같은 instant를 서울·LA × ko·en으로 돌려 결과가 언어에 따라 바뀌지 않는지 본다.

## Integration (실제 PostgreSQL)

정본: [global-setup](../test/setup/global-setup.ts), [managed-test-database](../test/setup/managed-test-database.ts), [TestDatabase](../test/setup/test-database.ts).

1. global setup이 실행별 `aido_test_<run-id>` DB와 worker별 DB를 만든다. `AIDO_TEST_POSTGRES_URL`이 있으면 그 전용 service, 없으면 로컬 Testcontainers다. `DATABASE_URL` fallback은 없다.
2. 그 DB에 마이그레이션을 적용하고 worker에 넘긴다. spec은 앱·client 수명을 소유하고, 사이에는 `testDatabase.cleanup()`을 쓴다.
3. 자신이 만든 DB·컨테이너만 정리한다. URI·비밀은 출력하지 않는다.

- 실패 지점 뒤 실제 행, 다음 실행의 claim 가능성, 남아야 할 토큰·멱등 행·outbox를 본다. 경합은 barrier와 lock waiter로 같은 경계에서 기다렸는지 확인한다.
- 사례: [transaction-propagation](../test/integration/transaction-propagation.integration-spec.ts)(CLS·Required·Nested·after-commit), [domain-event-fan-out](../test/integration/domain-event-fan-out.integration-spec.ts)(구독자별 작업), [todo-timezone-rebase](../test/integration/todo-timezone-rebase.integration-spec.ts)(실제 pg-boss 재계산), [push-receipt-consistency](../test/integration/notification/push/push-receipt-consistency.integration-spec.ts)(token·receipt 한 UoW).

## E2E (실제 HTTP)

[createE2eApp](../test/e2e/helpers/e2e-app-factory.ts)이 실제 AppModule을 조립하고 관리형 PostgreSQL을 연결한다. Email·OAuth·Push·AI·Weather·job queue는 Fake다.

- 각 케이스는 필요한 데이터를 스스로 준비하고 `ctx.reset()`으로 정리한다. 새 override는 `customizeBuilder`, mutable Fake는 `additionalResetters`로 넣는다.
- 공개 route·validation·nullable/default·오류 우선순위, 401·비소유·premium 경계, 저장 결과를 본다. 응답 body는 공유 schema로 `.parse`한다. 앱은 [응답 계약 검사](http-contracts.md#응답-계약-검사)를 켠 채로 떠서 선언과 다른 성공 응답은 500이 된다.
- throttle은 기본으로 꺼져 있다. 검증할 때만 `withRealThrottler: true`를 쓴다.
- [OpenAPI 계약](../test/e2e/openapi-contract.e2e-spec.ts)과 released fixture가 출시 앱 응답 모양을 지킨다([절차](http-contracts.md#출시-앱-호환-절차)).

## 실행

| 프로젝트      | 대상                                                      | 명령                                    |
| ------------- | --------------------------------------------------------- | --------------------------------------- |
| `unit`        | `src/**/*.spec.ts`, `test/setup`·`test/architecture` spec | `pnpm --filter @aido/server test`       |
| `integration` | `test/integration/**/*.integration-spec.ts`               | `pnpm test:integration`                 |
| `e2e`         | `test/e2e/**/*.e2e-spec.ts`                               | `pnpm test:e2e`, 계약만 `test:contract` |
| `performance` | `test/performance/**/*.performance-spec.ts`(수동), 소크   | `test:performance`                      |

```sh
pnpm --filter @aido/server exec vitest run --project unit src/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case.spec.ts
pnpm --filter @aido/server exec vitest run --project integration test/integration/notification/push/push-receipt-consistency.integration-spec.ts --sequence.seed=101
```

1. 변경한 동작의 가장 작은 suite를 돌린다. 계약·SQL·worker 변경이면 그 위험의 HTTP·PG 범위를 더한다.
2. 실패를 고친 뒤 실패한 범위와 영향 범위만 다시 돌린다.
3. 넓은 구조 변경은 소스를 동결한 뒤 관련 전체 suite와 lint·format·typecheck를 한 번 확인한다.

로컬 개발 DB에 앱 QA용 댓글 대화를 만들 때는 `pnpm --filter @aido/server fixture:todo-comments -- --owner-id <id> --todo-id <id>`를 쓴다. `--apply` 없이는 계획만 출력하고, 개발 환경·loopback API·로컬 DB가 아니면 멈춘다([fixture](../test/dev-fixtures/todo-comment-development-fixture.ts)).

DB 프로젝트는 worker마다 자기 DB를 받아 파일을 병렬로 돌리고 순서를 섞는다. 결과에는 파일·seed·실행 수를 남기고, 수집 오류로 0개가 돈 결과를 통과로 적지 않는다. 정본은 [vitest.config.ts](../vitest.config.ts)다.

## 실행 자원과 flake

- worker 수: API unit·`packages/api`·Mobile Jest는 `AIDO_TEST_WORKERS`(양의 정수 또는 `1%`~`100%`, 기본 `50%`·`25%`·`50%`), DB 프로젝트는 `AIDO_TEST_DB_WORKERS`(기본 2~4)를 읽는다. 여러 suite·에이전트가 함께 돌 때 이 값으로 줄이고, 잘못된 값은 바로 실패한다([tooling/vitest](../../../tooling/vitest/README.md)).
- 테스트 PostgreSQL은 Non-Durable Settings(`fsync`·`synchronous_commit`·`full_page_writes` off)와 tmpfs로 뜬다. DB가 느려서 통과하는 테스트를 남기지 않는다.
- 비교마다 시각 출처는 하나다. DB 기본값(`now()`)·`CURRENT_TIMESTAMP`와 비교할 시각은 DB 시계(`clock_timestamp()`)에서 읽거나 행에 고정 시각을 넣고, 호스트 `new Date()`와 섞지 않는다. `timestamp(3)` 열은 ms로 반올림돼 방금 쓴 행이 바로 뒤 `CURRENT_TIMESTAMP`보다 늦을 수 있어, 그런 열은 같은 정밀도(`LOCALTIMESTAMP(3)`)와 비교한다.
- 경쟁 순서는 시간이 아니라 barrier와 lock 대기(`pg_stat_activity`·`pg_locks`)로 강제한다.
- 결과는 `vi.waitFor`·`expect.poll`에 `timeout`·`interval`을 적어 기다린다. 고정 `setTimeout`은 "일어나지 않음" 확인에만 이유 주석과 함께 쓴다. pg-boss worker는 [fast-job-timing](../test/integration/helpers/fast-job-timing.ts)의 짧은 polling·재시도를 쓴다.
- Vitest `retry`·재실행으로 가리지 않는다. 실패는 출력된 seed(`--sequence.seed`)로 그 파일을 여러 번 돌려 재현한다. 타이밍 실패는 같은 seed에서도 매번 나지 않는다.

## 메모리

프로세스 안 저장소·타이머가 새지 않는지는 `performance` 프로젝트의 소크 테스트(수동)로 본다. 규칙은 [확장](scaling.md#메모리)에 있다.

- 프로세스 안 저장소·타이머를 바꾸면 [메모리 소크](../test/performance/memory-soak.performance-spec.ts)를 혼자 돌린다. 실제 pg-boss로 띄운 앱에 주요 경로 5천 번·큐 작업 1천 건을 보내고 `global.gc()` 뒤 힙 증가가 4MB 미만인지 본다. 기본 `test`·CI에는 없다.
- [종료 handle 검사](../test/e2e/app-shutdown-handles.e2e-spec.ts)는 E2E에 있다. `app.close()` 뒤 stdio 말고 남은 타이머·소켓이 없어야 한다.

```sh
AIDO_TEST_DB_WORKERS=2 pnpm --filter @aido/server exec vitest run --project performance test/performance/memory-soak.performance-spec.ts
```

## 옛 테스트 도우미

옛 spec 일부가 아직 `test/mocks`·`test/builders`를 쓴다. 기존 테스트를 일괄 교체하지 않고 그 spec을 고칠 때 위 구조로 옮긴다. 마지막에 `test/builders`를 fixtures로, `test/mocks`를 doubles로 합친다.

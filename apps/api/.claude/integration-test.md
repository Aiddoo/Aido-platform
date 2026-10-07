# 서버 Integration 테스트

실제 Module 연결이나 PostgreSQL의 데이터·트랜잭션 의미가 검증 대상일 때 사용한다. 단순 Application 분기는 [Unit](./unit-test.md), HTTP validation·권한·응답은 [E2E](./e2e-test.md)가 담당한다. 파일의 project 이름보다 실행한 실제 구성과 증거 범위를 명확히 적는다.

## 대역과 실제 DB 선택

`createMockDatabaseContext()`·`createMockDatabaseService(context)`·`createMockTransactionHost(context)`는 동일 native ORM context를 사용하는 기존 DI/쿼리 조립 대역이다. 결과 projection·조건·정렬·호출 순서를 확인할 때 사용할 수 있다. `createUnitOfWorkMock()`이 callback을 실행해도 commit·rollback·constraint를 검증한 것은 아니다.

실제 PG 검증이 이미 같은 조립과 의미를 확인한다면 대역 DI 테스트를 자동으로 추가하거나 유지하지 않는다. 제거할 때는 고유 assertion이 실제 테스트에 남는지 확인한다. 기존 mock ORM의 `.all()`/`.createAll()`에는 `nativeRows`, 단건에는 `databaseFixture`와 필요한 projection을 사용하고 미설정 undefined를 행 부재로 취급하지 않는다.

실제 PostgreSQL이 필요한 예:

- 실패 시 business row·receipt·Todo·outbox가 함께 rollback되는지
- Required 중첩 UoW와 CLS, after-commit 효과
- atomic claim/counter, unique/check/FK constraint, retry/idempotency
- 사용자 row lock·토큰 회전·이전 receipt와 새 token의 경합
- migration graph·기존 행·index·DATE/UTC codec·구 client 호환성

## 관리형 PostgreSQL 수명주기

정본은 [global-setup](../test/setup/global-setup.ts), [managed-test-database](../test/setup/managed-test-database.ts), [setup-env](../test/setup-env.ts), [TestDatabase](../test/setup/test-database.ts)이다.

1. DB project global setup이 실행별 `aido_test_<run-id>`를 만든다. `AIDO_TEST_POSTGRES_URL`이 있으면 `postgres` 관리 DB를 가리키는 전용 service를 사용하고, 없으면 로컬 PostgreSQL Testcontainers를 시작한다.
2. 실행 DB에 기존 native migration graph를 적용하고 Vitest `provide`/`inject`로 worker에 전달한다. 관리 marker와 DB 이름 allowlist를 확인한다. 운영/공유 개발 DB나 `DATABASE_URL` fallback을 사용하지 않는다.
3. `TestDatabase.start()`는 관리형 DB client를 연결한다. spec은 앱/module과 client의 수명주기를 소유하고, global setup 반환 teardown은 자신이 생성한 DB/컨테이너를 제거한다.
4. spec 간에는 `testDatabase.cleanup()` 또는 해당 실제 harness의 reset 경로를 사용한다. 앱·잔류 background work·cache를 정리한 뒤 client를 닫는다. 주입받은 client를 다른 provider가 대신 종료하지 않는다.

원래 관리형 임시 환경에서 필요한 생성·migration·초기화·소유 자원 정리는 승인된 작업 범위 안에서 진행할 수 있다. 다른 작업의 DB/컨테이너를 일괄 정리하지 않는다. teardown 실패나 중단이 있으면 자신의 DB 이름으로 잔여 여부를 확인하고 자신의 자원만 정리한다. URI/비밀은 출력하지 않고 DB 이름과 잔여 수를 기록한다.

실제 repository harness는 `createTestDatabaseService(client)`와 `createDatabaseTransactionFixture(client)`의 같은 database·txHost·uow를 연결한다. 가능하면 운영 Composition Root를 재사용한다. 복합 User fixture는 `createUserDatabaseFixture` 등 기존 소유 fixture를 사용하고 native scalar create에 ORM 중첩 쓰기 형태를 넣지 않는다.

## 결정적인 동시성·rollback 검증

처리기 시작·성공만 확인하지 않는다. 실패 지점 뒤 실제 행 상태, 다음 실행의 조회/claim 가능성, 남아야 할 token·멱등 행·outbox를 확인한다. 실패 전후를 따로 실행했다면 그 단계와 기대 실패를 기록한다.

경합은 Promise/transaction barrier와 PostgreSQL lock waiter를 관찰해 작업이 실제 같은 경계에서 대기했음을 확인한다. 한 tick·임의 sleep·`Promise.all`만으로 경합 발생을 단정하지 않는다. 요청 fixture를 구분하고 완전한 최종 행을 확인한다. timeout이 작업을 취소한다고 가정하지 않으며, 실패한 reset 환경을 다음 테스트에 재사용하지 않는다.

DB/socket/job의 timer는 native로 유지한다. 날짜만 필요한 경우 Date-only fake를 `finally`/`afterEach`에서 복원하거나 영속 timestamp를 명시한다. host UTC/KST/다른 timezone 및 DST 검증은 실제 날짜/기간 경계가 변경된 범위에 한정한다.

실제 예제:

- [prisma8-transaction](../test/integration/prisma8-transaction.integration-spec.ts): 실제 CLS·Required·after-commit.
- [job-runtime-postgres](../test/integration/job-runtime-postgres.integration-spec.ts): business mutation과 durable job 원자성.
- [ai-generation-consistency](../test/integration/ai-generation-consistency.integration-spec.ts): 실제 premium 상태·accept/rollback 정합성.
- [weather-location](../test/integration/weather-location.integration-spec.ts): 위치 upsert·경합.
- [push-receipt-consistency](../test/integration/push-receipt-consistency.integration-spec.ts): token·receipt·동일 UoW 실패/재시도.

## 공급자 SDK와 HTTP fixture

[이메일 Integration](../test/integration/email.integration-spec.ts)은 실제 NotificationEmailModule/Resend SDK와 고정 `StubResendHttp`를 조립한다. 외부 요청 대신 fixture 응답으로 payload·인증/idempotency 헤더·오류·retry/backoff를 확인한다. DB가 없는 이 suite의 retry timer는 제어할 수 있다. 이를 native DB와 timer가 섞인 테스트에 그대로 적용하지 않는다.

미설정/unmatched 요청은 차단하고 각 테스트의 fixture 응답 소비, globals/env/timer 복원과 module 종료를 확인한다. transport를 교체한 결과는 실제 공급자 운영 품질·SLA 증거가 아니다. E2E의 외부 Fake와 wire fixture는 서로 다른 경계를 검증하며 둘 중 하나를 전체 SDK mock으로 대체할 필요는 없다.

```sh
pnpm --filter @aido/server exec vitest run --project integration test/integration/push-receipt-consistency.integration-spec.ts --sequence.seed=101
```

파일 직렬 실행과 shuffle은 현재 DB project 설정이 소유한다. 작업 중에는 관련 범위만 실행하고, module 최종 동결 뒤 전체 gate는 [검증 범위 선택](./testing-guide.md)의 완료 담당자가 한 번 실행한다.

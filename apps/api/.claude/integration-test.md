# 서버 Integration 테스트

실제 Module 연결이나 PostgreSQL의 데이터·트랜잭션 의미가 검증 대상일 때 쓴다. 단순 Application 분기는 [Unit](./unit-test.md), HTTP validation·권한·응답은 [E2E](./e2e-test.md)가 맡는다.

## 실제 PostgreSQL이 필요한 경우

- 실패 시 업무 행·receipt·Todo·outbox가 함께 rollback되는지
- Required 중첩 UoW와 CLS, after-commit 효과
- atomic claim/counter, unique/check/FK constraint, retry/idempotency
- 사용자 행 잠금, 토큰 회전, 이전 receipt와 새 token의 경합
- migration·기존 행·index·DATE/UTC codec·구 client 호환성

`createUnitOfWorkMock()`이 callback을 실행해도 commit·rollback·constraint를 검증한 것은 아니다.

## 관리형 PostgreSQL

정본은 [global-setup](../test/setup/global-setup.ts), [managed-test-database](../test/setup/managed-test-database.ts), [setup-env](../test/setup-env.ts), [TestDatabase](../test/setup/test-database.ts)다.

1. global setup이 실행별 `aido_test_<run-id>`를 만든다. `AIDO_TEST_POSTGRES_URL`이 있으면 그 전용 service, 없으면 로컬 Testcontainers다.
2. 그 DB에 migration을 적용하고 `provide`/`inject`로 worker에 넘긴다. 관리 marker와 DB 이름 allowlist를 확인한다. `DATABASE_URL` fallback은 없다.
3. `TestDatabase.start()`가 client를 연결한다. spec은 앱·module과 client의 수명을 소유하고 global setup은 자신이 만든 DB/컨테이너를 지운다.
4. spec 사이에는 `testDatabase.cleanup()` 또는 그 harness의 reset을 쓴다. 앱·잔류 작업·cache를 정리한 뒤 client를 닫는다.

다른 작업의 DB/컨테이너를 정리하지 않는다. 중단 뒤에는 자신의 DB 이름으로 잔여를 확인한다. URI·비밀은 출력하지 않는다.

Repository harness는 `createDatabaseTransactionFixture(client)`로 database·txHost·uow를 연결한다. 가능하면 운영 Composition Root를 재사용한다. 복합 User fixture는 `createUserDatabaseFixture`를 쓴다.

## 결정적인 동시성·rollback 검증

- 처리기 시작·성공만 보지 않는다. 실패 지점 뒤 실제 행, 다음 실행의 claim 가능성, 남아야 할 token·멱등 행·outbox를 본다.
- 경합은 Promise/transaction barrier와 lock waiter를 관찰해 실제로 같은 경계에서 기다렸는지 확인한다. 임의 sleep·`Promise.all`만으로 경합을 단정하지 않는다.
- timeout이 작업을 취소한다고 가정하지 않는다. 실패한 reset 환경을 다음 테스트에 재사용하지 않는다.
- DB/socket/job timer는 native로 둔다. 날짜만 필요하면 Date-only fake를 복원하거나 timestamp를 명시한다.

예제:

- [transaction-propagation](../test/integration/transaction-propagation.integration-spec.ts), [transaction-error](../test/integration/transaction-error.integration-spec.ts): CLS·Required·Nested·after-commit
- [job-runtime-postgres](../test/integration/job-runtime-postgres.integration-spec.ts): 업무 변경과 durable job 원자성
- [quota-ledger](../test/integration/quota-ledger.integration-spec.ts): 예약·확정·환불의 동시성
- [todo-timezone-rebase](../test/integration/todo-timezone-rebase.integration-spec.ts): 실제 pg-boss 재계산과 왕복 멱등
- [push-receipt-consistency](../test/integration/push-receipt-consistency.integration-spec.ts): token·receipt·동일 UoW 실패/재시도

## 공급자 SDK와 HTTP fixture

- [이메일](../test/integration/email.integration-spec.ts): 실제 NotificationEmailModule 배선·Resend SDK·`StubResendHttp`로 큐에 담기 → worker 발송.
- [이메일 큐](../test/integration/email-delivery-queue.integration-spec.ts): 실제 pg-boss에서 암호화 저장·중복 건 한 번 발송·재시도.
- [발송 예산](../test/integration/email-budget.integration-spec.ts): 실제 Postgres 계량기의 동시 예약.
- 어댑터 계약(`email-sender.contract.ts`·`admin-notifier.contract.ts`)은 어댑터 spec에서 같은 시나리오로 돌린다.

미설정 요청은 막고 globals/env/timer를 복원한다. transport를 바꾼 결과는 공급자 품질의 증거가 아니다.

```sh
pnpm --filter @aido/server exec vitest run --project integration test/integration/push-receipt-consistency.integration-spec.ts --sequence.seed=101
```

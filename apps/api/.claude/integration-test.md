# 통합 테스트 가이드

**Version**: 2.0.0 · **Last Updated**: 2026-10-06 · **Owner**: Aido Platform Team

통합 테스트는 실제 Nest DI 배선과 PostgreSQL의 데이터·트랜잭션 의미를 검증한다. HTTP 계약은 [E2E 가이드](./e2e-test.md), 단위 테스트는 [unit-test.md](./unit-test.md)를 따른다.

## Mock DB를 쓰는 DI 검증

`createMockDatabaseContext()`는 native ORM의 fluent API를 제공한다. `createMockDatabaseService(context)`는 같은 context를 DatabaseService에 연결한다. Repository에 주입하는 TransactionHost도 같은 context를 사용한다. `createUnitOfWorkMock()`은 DI·흐름 검증용이며 rollback을 증명하지 않는다.

```ts
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  createMockDatabaseContext,
  createMockTransactionHost,
  databaseFixture,
  nativeRows,
} from '#test/mocks/database.mock';
import { createMockDatabaseService } from '#test/mocks/mock-database.factory';
import { TodoBuilder } from '#test/builders/index';

const context = createMockDatabaseContext();
const database = createMockDatabaseService(context);
const host = createMockTransactionHost(context);
const rows = databaseFixture('Todo', [TodoBuilder.create('user-1').build()]);
context.orm.public.Todo.all.mockReturnValue(nativeRows(rows));

const providers = [
  { provide: DatabaseService, useValue: database },
  { provide: TransactionHost, useValue: host },
];
```

`.all()`/`.createAll()`은 `nativeRows()`로 await와 async iteration을 모두 지원한다. 단건 결과는 `databaseFixture()`로 application Date와 native codec의 경계를 맞춘다. 부분 projection의 mock은 `asMock()`을 사용할 수 있다. `null`인 단건 조회와 정상 행을 구분하고 미설정 `undefined`를 부재 데이터로 사용하지 않는다.

조건은 `.where.mock.calls`, 정렬은 `.orderBy.mock.calls`, 페이지 크기는 `.limit`에서 검증한다. `assertNativeWhere`/`assertNativeOrder`는 실제 ORM accessor로 AST를 만들며 연결을 열지 않는다. 바인딩된 SQL 값은 `nativeSqlParameters`로 확인한다. 읽기 terminal의 meta callback을 조건 객체로 취급하지 않는다.

## 실제 DB와 native 트랜잭션

Vitest integration project의 global setup은 실행마다 고유한 Testcontainers PostgreSQL을 만들고 검토된 native migration graph를 적용한다. TestDatabase는 관리형 URL 검증, 연결, truncate와 종료를 소유한다. 로컬·운영 DB를 테스트 대상으로 재사용하지 않는다.

```ts
import { TestDatabase } from '#test/setup/test-database';
import {
  createDatabaseTransactionFixture,
  createTestDatabaseService,
} from '#test/setup/database-context';

const testDatabase = new TestDatabase();
const client = await testDatabase.start();
const database = createTestDatabaseService(client);
const transaction = createDatabaseTransactionFixture(client);

// TestingModule provider에 같은 database, transaction.txHost, transaction.uow를 연결한다.
await transaction.uow.run(async () => {
  await transaction.txHost.tx.orm.public.User.where({ id: 'user-1' }).update({ status: 'LOCKED' });
});
await testDatabase.stop();
```

`createDatabaseTransactionFixture`는 AsyncLocalStorage로 활성 native transaction을 전달하고 중첩 Required 호출을 같은 연결에 참여시킨다. 실제 CLS plugin·after-commit은 `prisma8-transaction.integration-spec.ts`에서 검증한다. 업무 행과 queue enqueue의 원자성은 `job-runtime-postgres.integration-spec.ts`에서 검증한다.

User의 profile/preference/consent 등 복합 fixture는 `createUserDatabaseFixture`를 사용한다. native ORM의 scalar create에 중첩 쓰기 객체를 전달하지 않는다. 운영과 동일한 외래 키·unique·check constraint를 유지한다.

## 격리와 검증

- `beforeEach`에서 logger/spy와 fixture를 준비하고 `await testDatabase.cleanup()`으로 데이터를 초기화한다.
- `afterAll`에서는 앱·module을 먼저 종료하고 DB 연결을 닫는다. module provider는 TestDatabase가 소유한 client를 대신 종료하지 않는다.
- 파일은 직렬로 실행하고 순서를 섞어 상태 의존을 찾는다. 독립된 native transaction 테스트의 병렬 요청은 AsyncLocalStorage로 격리한다.
- 동시성은 barrier와 PostgreSQL lock 관찰로 검증한다. 임의 sleep으로 순서를 가정하지 않는다.
- 기존 사용자 데이터·index OID·계약 marker·migration graph, SQLSTATE, rollback, 오래된 클라이언트의 응답을 함께 검증한다.

```sh
pnpm --filter @aido/api test:integration
pnpm --filter @aido/api exec vitest run --project integration prisma8-transaction
```

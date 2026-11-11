import { DrizzleMemoRepository } from "#api/modules/notes/memos/infrastructure/persistence/drizzle-memo.repository";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { describeMemoRepositoryContract } from "#test/contracts/notes/memo-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  createMemoFixture,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleMemoRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: MEMO_FIXTURE_USER_ID }),
        UserFixture.create({ id: MEMO_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleMemoRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleMemoRepository(txHost);
  }

  describeMemoRepositoryContract(async () => createRepository());

  it("없는 메모를 지우면 부재 오류를 낸다", async () => {
    // Given
    const repository = createRepository();
    const missing = createMemoFixture({ id: (await repository.nextId()).value });

    // When
    const result = repository.delete(missing);

    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const memo = createMemoFixture({
      id: (await repository.nextId()).value,
      createdAt,
      updatedAt: createdAt.add({ seconds: 5 }),
    });

    // When
    await repository.save(memo);
    const found = await repository.findByIdAndUserId(memo.id, memo.userId);

    // Then
    expect(found?.toPrimitives()).toEqual(memo.toPrimitives());
  });
});

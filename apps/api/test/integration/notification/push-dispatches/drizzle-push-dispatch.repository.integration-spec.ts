import { DrizzlePushDispatchRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-dispatch.repository";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

describe("DrizzlePushDispatchRepository (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let repository: DrizzlePushDispatchRepository;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    const client = await testDatabase.start();
    repository = new DrizzlePushDispatchRepository(
      createDatabaseTransactionFixture(client).transactionHost,
    );
  }, 60_000);

  afterAll(async () => {
    await testDatabase?.stop();
  });

  it("0개를 달라고 하면 시퀀스를 건드리지 않고 빈 목록을 준다", async () => {
    // Given
    const [before] = await repository.nextIds(1);

    // When
    const ids = await repository.nextIds(0);
    const [after] = await repository.nextIds(1);

    // Then
    expect(ids).toEqual([]);
    expect((after?.value ?? 0) - (before?.value ?? 0)).toBe(1);
  });

  it("여러 개를 달라고 하면 오름차순 id를 준다", async () => {
    // When
    const ids = await repository.nextIds(3);

    // Then
    const values = ids.map((id) => id.value);
    expect(values).toHaveLength(3);
    expect(values).toEqual(values.toSorted((left, right) => left - right));
  });
});

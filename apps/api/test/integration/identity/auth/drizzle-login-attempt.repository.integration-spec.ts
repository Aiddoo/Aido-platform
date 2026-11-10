import { DrizzleLoginAttemptRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-login-attempt.repository";
import { describeAuthLoginAttemptRepositoryContract } from "#test/contracts/identity/auth-login-attempt-repository.contract";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleLoginAttemptRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleLoginAttemptRepository {
    return new DrizzleLoginAttemptRepository(client);
  }

  describeAuthLoginAttemptRepositoryContract(async () => createRepository());

  it("로그인 시도는 바깥 트랜잭션이 롤백돼도 남는다", async () => {
    // Given
    const repository = createRepository();
    const { uow } = createDatabaseTransactionFixture(client);
    const attemptedAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const failure = new Error("후속 쓰기 실패");

    // When
    const outcome = uow.run(async () => {
      await repository.create({
        email: "rollback@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "Aido/1.15.1",
        success: false,
        attemptedAt,
      });
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    expect(await repository.countRecentFailuresByEmail("rollback@example.com", attemptedAt)).toBe(
      1,
    );
  });
});

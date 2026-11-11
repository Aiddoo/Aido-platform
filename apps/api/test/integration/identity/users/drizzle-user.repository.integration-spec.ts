import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { describeAuthUserRepositoryContract } from "#test/contracts/identity/auth-user-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleUserRepository (실제 PostgreSQL)", () => {
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

  function createRepository(): DrizzleUserRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserRepository(txHost, new DateClock());
  }

  describeAuthUserRepositoryContract(async () => createRepository());
});

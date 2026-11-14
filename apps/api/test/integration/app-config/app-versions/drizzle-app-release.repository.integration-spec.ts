import { DrizzleAppReleaseRepository } from "#api/modules/app-config/app-versions/infrastructure/persistence/drizzle-app-release.repository";
import { describeAppReleaseRepositoryContract } from "#test/contracts/app-config/app-release-repository.contract";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleAppReleaseRepository (실제 PostgreSQL)", () => {
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

  describeAppReleaseRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleAppReleaseRepository(txHost);
  });
});

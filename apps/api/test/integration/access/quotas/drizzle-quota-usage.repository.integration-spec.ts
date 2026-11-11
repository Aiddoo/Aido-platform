import { DrizzleQuotaUsageRepository } from "#api/modules/access/quotas/infrastructure/persistence/drizzle-quota-usage.repository";
import { user } from "#api/platform/database/schema/index";
import { describeQuotaUsageRepositoryContract } from "#test/contracts/access/quota-usage-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleQuotaUsageRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let seeded = 0;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    seeded = 0;
  });

  afterAll(async () => {
    await database.stop();
  });

  describeQuotaUsageRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      repository: new DrizzleQuotaUsageRepository(txHost),
      seedUser: async ({ id, aiUsageCount, aiUsageResetAt }) => {
        seeded += 1;
        await client.insert(user).values(
          UserFixture.create({
            id,
            userTag: `QUSG${String(seeded).padStart(4, "0")}`,
            aiUsageCount,
            aiUsageResetAt,
          }),
        );
      },
    };
  });
});

import { DrizzleAccessStateReader } from "#api/modules/access/entitlements/infrastructure/persistence/drizzle-access-state.reader";
import { DrizzleResourceBonusRepository } from "#api/modules/access/entitlements/infrastructure/persistence/drizzle-resource-bonus.repository";
import { user } from "#api/platform/database/schema/index";
import { describeAccessStateReaderContract } from "#test/contracts/access/access-state-reader.contract";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleAccessStateReader·DrizzleResourceBonusRepository (실제 PostgreSQL)", () => {
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

  describeAccessStateReaderContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      reader: new DrizzleAccessStateReader(txHost),
      resourceBonusRepository: new DrizzleResourceBonusRepository(txHost),
      seedUser: async ({ id, role, subscriptionStatus, subscriptionExpiresAt, isActive }) => {
        seeded += 1;
        await client.insert(user).values(
          UserFixture.create({
            id,
            userTag: `ACCS${String(seeded).padStart(4, "0")}`,
            role,
            subscriptionStatus,
            subscriptionExpiresAt,
            status: isActive ? "ACTIVE" : "LOCKED",
          }),
        );
      },
    };
  });
});

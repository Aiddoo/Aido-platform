import { DrizzleAccessStateReader } from "#api/modules/access/feature-grants/infrastructure/persistence/drizzle-access-state.reader";
import { DrizzleFeatureGrantRepository } from "#api/modules/access/feature-grants/infrastructure/persistence/drizzle-feature-grant.repository";
import { featureGrant, user } from "#api/platform/database/schema/index";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { describeAccessStateReaderContract } from "#test/contracts/access/access-state-reader.contract";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleAccessStateReader·DrizzleFeatureGrantRepository (실제 PostgreSQL)", () => {
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
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return {
      reader: new DrizzleAccessStateReader(transactionHost),
      featureGrantRepository: new DrizzleFeatureGrantRepository(transactionHost),
      seedFriendGrantRow: async ({ userId, quantity }) => {
        const id = createEntityId();
        await client
          .insert(featureGrant)
          .values({ id, userId, resource: "FRIEND", quantity, sourceKey: `seed:${id}` });
      },
      seedUser: async ({ id, role, subscriptionStatus, subscriptionExpiresAt, isActive }) => {
        seeded += 1;
        await client.insert(user).values(
          createUserRowFixture({
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

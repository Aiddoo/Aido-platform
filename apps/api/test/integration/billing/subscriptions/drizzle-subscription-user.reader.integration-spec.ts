import { DrizzleSubscriptionUserReader } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription-user.reader";
import { user, userProfile } from "#api/platform/database/schema/index";
import { describeSubscriptionUserReaderContract } from "#test/contracts/billing/subscription-user-reader.contract";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSubscriptionUserReader (실제 PostgreSQL)", () => {
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

  describeSubscriptionUserReaderContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      reader: new DrizzleSubscriptionUserReader(txHost),
      seedUser: async ({ id, email, name, appUserAlias }) => {
        seeded += 1;
        const { user: userRow, profile } = UserFixture.createWithProfile(
          {
            id,
            email,
            userTag: `SUBU${String(seeded).padStart(4, "0")}`,
            revenueCatUserId: appUserAlias ?? null,
          },
          { name },
        );
        await client.insert(user).values(userRow);
        if (name != null) {
          await client.insert(userProfile).values(profile);
        }
      },
    };
  });
});

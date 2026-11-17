import { DrizzleSubscriptionUserReader } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription-user.reader";
import { user, userProfile } from "#api/platform/database/schema/index";
import { describeSubscriptionUserReaderContract } from "#test/contracts/billing/subscription-user-reader.contract";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";
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
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return {
      reader: new DrizzleSubscriptionUserReader(transactionHost),
      seedUser: async ({ id, email, name, appUserAlias }) => {
        seeded += 1;
        const { user: userRow, profile } = UserFixture.createWithProfile(
          {
            id,
            email,
            userTag: `SUBU${String(seeded).padStart(4, "0")}`,
            storeAppUserId: appUserAlias ?? null,
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

  it("별칭이 다른 사용자의 User.id와 같으면 별칭 주인을 고른다", async () => {
    // Given
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const reader = new DrizzleSubscriptionUserReader(transactionHost);
    const idOwner = UserFixture.createWithProfile({
      id: SUBSCRIPTION_FIXTURE_USER_ID,
      email: "id-owner@example.com",
      userTag: "SUBU0001",
    });
    const aliasOwner = UserFixture.createWithProfile({
      id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
      email: "alias-owner@example.com",
      userTag: "SUBU0002",
      storeAppUserId: SUBSCRIPTION_FIXTURE_USER_ID,
    });
    await client.insert(user).values([idOwner.user, aliasOwner.user]);

    // When
    const found = await reader.findFirstByAppUserIds([SUBSCRIPTION_FIXTURE_USER_ID]);

    // Then
    expect(found?.id.value).toBe(SUBSCRIPTION_FIXTURE_OTHER_USER_ID);
  });
});

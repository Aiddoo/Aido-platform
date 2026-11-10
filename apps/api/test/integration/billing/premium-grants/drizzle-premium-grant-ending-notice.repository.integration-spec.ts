import { DrizzlePremiumGrantEndingNoticeRepository } from "#api/modules/billing/premium-grants/infrastructure/persistence/drizzle-premium-grant-ending-notice.repository";
import { DrizzlePremiumGrantRepository } from "#api/modules/billing/premium-grants/infrastructure/persistence/drizzle-premium-grant.repository";
import { DrizzleSubscriptionRepository } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription.repository";
import { user } from "#api/platform/database/schema/index";
import { describePremiumGrantEndingNoticeRepositoryContract } from "#test/contracts/billing/premium-grant-ending-notice-repository.contract";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzlePremiumGrantEndingNoticeRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "GRNOWN01",
      }),
      UserFixture.create({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "GRNOTH01",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describePremiumGrantEndingNoticeRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      repository: new DrizzlePremiumGrantEndingNoticeRepository(txHost),
      grants: new DrizzlePremiumGrantRepository(txHost),
      subscriptions: new DrizzleSubscriptionRepository(txHost),
    };
  });
});

import { DrizzleSubscriptionRepository } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription.repository";
import { DrizzleTrialEndingNoticeRepository } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-trial-ending-notice.repository";
import { user } from "#api/platform/database/schema/index";
import { describeTrialEndingNoticeRepositoryContract } from "#test/contracts/billing/trial-ending-notice-repository.contract";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleTrialEndingNoticeRepository (실제 PostgreSQL)", () => {
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
        userTag: "TRLOWN01",
      }),
      UserFixture.create({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "TRLOTH01",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeTrialEndingNoticeRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      repository: new DrizzleTrialEndingNoticeRepository(txHost),
      subscriptions: new DrizzleSubscriptionRepository(txHost),
    };
  });
});

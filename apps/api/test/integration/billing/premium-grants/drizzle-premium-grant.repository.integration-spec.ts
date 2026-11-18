import { DrizzlePremiumGrantRepository } from "#api/modules/billing/premium-grants/infrastructure/persistence/drizzle-premium-grant.repository";
import { user } from "#api/platform/database/schema/index";
import { describePremiumGrantRepositoryContract } from "#test/contracts/billing/premium-grant-repository.contract";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzlePremiumGrantRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      createUserRowFixture({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "BILLOWN2",
      }),
      createUserRowFixture({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "BILLOTH2",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzlePremiumGrantRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzlePremiumGrantRepository(transactionHost);
  }

  describePremiumGrantRepositoryContract(async () => createRepository());
});

import { DrizzleSubscriptionEventReceiptRepository } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription-event-receipt.repository";
import { describeSubscriptionEventReceiptRepositoryContract } from "#test/contracts/billing/subscription-event-receipt-repository.contract";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSubscriptionEventReceiptRepository (실제 PostgreSQL)", () => {
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

  describeSubscriptionEventReceiptRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleSubscriptionEventReceiptRepository(txHost);
  });
});

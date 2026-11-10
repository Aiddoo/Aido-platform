import { DrizzleBroadcastCampaignRepository } from "#api/modules/operations/broadcasts/infrastructure/persistence/drizzle-broadcast-campaign.repository";
import { describeBroadcastCampaignRepositoryContract } from "#test/contracts/operations/broadcast-campaign-repository.contract";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleBroadcastCampaignRepository (실제 PostgreSQL)", () => {
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

  describeBroadcastCampaignRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleBroadcastCampaignRepository(txHost);
  });
});

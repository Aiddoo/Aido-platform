import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { user } from "#api/platform/database/schema/index";
import { describeUserConsentRepositoryContract } from "#test/contracts/identity/user-consent-repository.contract";
import { createUserSettingsFixtureUsers } from "#test/fixtures/identity/user-settings.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleUserConsentRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values(createUserSettingsFixtureUsers());
  });

  afterAll(async () => {
    await database.stop();
  });

  describeUserConsentRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserConsentRepository(txHost);
  });
});

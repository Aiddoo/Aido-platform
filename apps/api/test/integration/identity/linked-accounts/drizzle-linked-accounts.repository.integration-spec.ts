import { DrizzleLinkedAccountsRepository } from "#api/modules/identity/linked-accounts/infrastructure/persistence/drizzle-linked-accounts.repository";
import { user } from "#api/platform/database/schema/index";
import { describeLinkedAccountsRepositoryContract } from "#test/contracts/identity/linked-accounts-repository.contract";
import {
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleLinkedAccountsRepository (실제 PostgreSQL)", () => {
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
        id: AUTH_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "AUTHOWN1",
      }),
      createUserRowFixture({
        id: AUTH_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "AUTHOTH1",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleLinkedAccountsRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleLinkedAccountsRepository(transactionHost);
  }

  describeLinkedAccountsRepositoryContract(async () => createRepository());
});

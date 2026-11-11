import { DrizzleSuggestionRepository } from "#api/modules/ai-assistance/suggestions/infrastructure/persistence/drizzle-suggestion.repository";
import { user } from "#api/platform/database/schema/index";
import { describeSuggestionRepositoryContract } from "#test/contracts/ai-assistance/suggestion-repository.contract";
import {
  SUGGESTION_FIXTURE_USER_ID,
  SUGGESTION_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/ai-assistance/suggestion.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSuggestionRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: SUGGESTION_FIXTURE_USER_ID }),
        UserFixture.create({ id: SUGGESTION_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeSuggestionRepositoryContract(
    async () => new DrizzleSuggestionRepository(createDatabaseTransactionFixture(client).txHost),
  );
});

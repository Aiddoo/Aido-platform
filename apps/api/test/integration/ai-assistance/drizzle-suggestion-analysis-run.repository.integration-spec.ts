import { eq } from "drizzle-orm";

import { DrizzleSuggestionAnalysisRunRepository } from "#api/modules/ai-assistance/suggestions/infrastructure/persistence/drizzle-suggestion-analysis-run.repository";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeSuggestionAnalysisRunRepositoryContract } from "#test/contracts/ai-assistance/suggestion-analysis-run-repository.contract";
import { createSuggestionAnalysisRunFixture } from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";
import {
  SUGGESTION_FIXTURE_OTHER_USER_ID,
  SUGGESTION_FIXTURE_USER_ID,
} from "#test/fixtures/ai-assistance/suggestion.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const TRANSACTION_STATEMENT = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i;

describe("DrizzleSuggestionAnalysisRunRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let statements: string[] | null = null;

  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, {}, (statement) => {
          statements?.push(statement);
        }),
    });
    client = await database.start();
  });

  beforeEach(async () => {
    statements = null;
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

  function createRepository(): DrizzleSuggestionAnalysisRunRepository {
    return new DrizzleSuggestionAnalysisRunRepository(
      createDatabaseTransactionFixture(client).txHost,
    );
  }

  describeSuggestionAnalysisRunRepositoryContract(async () => createRepository());

  it("여러 사용자의 저장과 읽기는 사람 수와 상관없이 각각 SQL 한 문장이다", async () => {
    // Given
    const repository = createRepository();
    const mine = createSuggestionAnalysisRunFixture();
    const other = createSuggestionAnalysisRunFixture({ userId: SUGGESTION_FIXTURE_OTHER_USER_ID });
    statements = [];

    // When
    await repository.saveMany([mine, other]);
    await repository.listByUserIds([mine.id, other.id]);
    await repository.save(mine);
    await repository.findByUserId(mine.id);
    const issued = statements.filter((statement) => !TRANSACTION_STATEMENT.test(statement));

    // Then
    expect(issued).toEqual([
      expect.stringMatching(/^insert into "SuggestionAnalysisRun" .+ on conflict/i),
      expect.stringMatching(/^select .+ from "SuggestionAnalysisRun" where .+ in \(/i),
      expect.stringMatching(/^insert into "SuggestionAnalysisRun" .+ on conflict/i),
      expect.stringMatching(/^select .+ from "SuggestionAnalysisRun"/i),
    ]);
  });

  it("사용자를 지우면 실행 기록도 함께 지워진다", async () => {
    // Given
    const repository = createRepository();
    await repository.save(createSuggestionAnalysisRunFixture());

    // When
    await client.delete(user).where(eq(user.id, SUGGESTION_FIXTURE_USER_ID));

    // Then
    expect(
      await repository.findByUserId(UserId.reconstitute(SUGGESTION_FIXTURE_USER_ID)),
    ).toBeNull();
  });
});

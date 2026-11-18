import { DrizzleAiReportRepository } from "#api/modules/ai-assistance/ai-reports/infrastructure/persistence/drizzle-ai-report.repository";
import { user } from "#api/platform/database/schema/index";
import { describeAiReportRepositoryContract } from "#test/contracts/ai-assistance/ai-report-repository.contract";
import {
  AI_REPORT_FIXTURE_USER_ID,
  AI_REPORT_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/ai-assistance/ai-report.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleAiReportRepository (실제 PostgreSQL)", () => {
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
        createUserRowFixture({ id: AI_REPORT_FIXTURE_USER_ID }),
        createUserRowFixture({ id: AI_REPORT_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeAiReportRepositoryContract(
    async () =>
      new DrizzleAiReportRepository(createDatabaseTransactionFixture(client).transactionHost),
  );
});

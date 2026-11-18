import { UserReportId } from "#api/modules/social/user-reports/domain/user-report-id.vo";
import { DrizzleUserReportRepository } from "#api/modules/social/user-reports/infrastructure/persistence/drizzle-user-report.repository";
import { user } from "#api/platform/database/schema/index";
import { describeUserReportRepositoryContract } from "#test/contracts/social/user-report-repository.contract";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createUserReportFixture,
  USER_REPORT_FIXTURE_ADMIN_ID,
  USER_REPORT_FIXTURE_REPORTER_ID,
  USER_REPORT_FIXTURE_REPORTER_TAG,
  USER_REPORT_FIXTURE_TARGET_USER_ID,
  USER_REPORT_FIXTURE_TARGET_USER_TAG,
} from "#test/fixtures/social/user-report.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleUserReportRepository (실제 PostgreSQL)", () => {
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
        id: USER_REPORT_FIXTURE_REPORTER_ID,
        userTag: USER_REPORT_FIXTURE_REPORTER_TAG,
      }),
      createUserRowFixture({
        id: USER_REPORT_FIXTURE_TARGET_USER_ID,
        userTag: USER_REPORT_FIXTURE_TARGET_USER_TAG,
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleUserReportRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserReportRepository(transactionHost);
  }

  describeUserReportRepositoryContract(async () => createRepository());

  it("접수·처리 시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const report = createUserReportFixture({
      id: UserReportId.generate().value,
      detail: "계속 욕설을 해요",
      status: "RESOLVED",
      createdAt: Temporal.Instant.from("2027-01-08T12:00:00.123Z"),
      resolvedAt: Temporal.Instant.from("2027-01-08T15:30:00.456Z"),
      resolvedById: USER_REPORT_FIXTURE_ADMIN_ID,
      resolutionNote: "댓글 삭제",
    });

    // When
    await repository.save(report);
    const found = await repository.findById(report.id);

    // Then
    expect(found?.toPrimitives()).toEqual(report.toPrimitives());
  });
});

import { UserReportId } from "#api/modules/social/reports/domain/user-report-id.vo";
import { DrizzleUserReportRepository } from "#api/modules/social/reports/infrastructure/persistence/drizzle-user-report.repository";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeUserReportRepositoryContract } from "#test/contracts/social/user-report-repository.contract";
import { UserFixture } from "#test/fixtures/index";
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

const DELETED_USER_ID = "clz7x5p8k0205qz0z8z8z8z8z";
const LOCKED_USER_ID = "clz7x5p8k0206qz0z8z8z8z8z";

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
      UserFixture.create({
        id: USER_REPORT_FIXTURE_REPORTER_ID,
        userTag: USER_REPORT_FIXTURE_REPORTER_TAG,
      }),
      UserFixture.create({
        id: USER_REPORT_FIXTURE_TARGET_USER_ID,
        userTag: USER_REPORT_FIXTURE_TARGET_USER_TAG,
      }),
      UserFixture.create({
        id: DELETED_USER_ID,
        deletedAt: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      }),
      UserFixture.create({ id: LOCKED_USER_ID, status: "LOCKED" }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleUserReportRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserReportRepository(txHost);
  }

  describeUserReportRepositoryContract(async () => createRepository());

  it("탈퇴했거나 활성 상태가 아닌 사용자는 신고 대상으로 없다고 본다", async () => {
    // Given
    const repository = createRepository();

    // When
    const exists = [
      await repository.existsActiveUser(UserId.reconstitute(DELETED_USER_ID)),
      await repository.existsActiveUser(UserId.reconstitute(LOCKED_USER_ID)),
    ];

    // Then
    expect(exists).toEqual([false, false]);
  });

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

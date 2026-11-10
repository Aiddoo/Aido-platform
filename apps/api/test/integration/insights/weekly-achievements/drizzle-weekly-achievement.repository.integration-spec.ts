import { DrizzleWeeklyAchievementRepository } from "#api/modules/insights/weekly-achievements/infrastructure/persistence/drizzle-weekly-achievement.repository";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeWeeklyAchievementRepositoryContract } from "#test/contracts/insights/weekly-achievement-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleWeeklyAchievementRepository (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID }),
        UserFixture.create({ id: WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleWeeklyAchievementRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleWeeklyAchievementRepository(txHost);
  }

  describeWeeklyAchievementRepositoryContract(async () => createRepository());

  it("묶음 뒤쪽이 없는 사용자라 FK가 실패하면 앞쪽 기록도 남기지 않는다", async () => {
    // Given
    const repository = createRepository();
    const [firstId = 0, secondId = 0] = (await repository.nextIds(2)).map((id) => id.value);
    const achievements = [
      createWeeklyAchievementFixture({ id: firstId, week: 1 }),
      createWeeklyAchievementFixture({ id: secondId, week: 2, userId: "missing-user" }),
    ];

    // When
    const failure = await repository.saveAll(achievements).catch((error: unknown) => error);

    // Then
    expect(databaseSqlState(failure)).toBe("23503");
    expect(
      await repository.listAllByYear({
        userId: UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID),
        year: 2026,
      }),
    ).toEqual([]);
  });

  it("달성 시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const [id = 0] = (await repository.nextIds(1)).map((nextId) => nextId.value);
    const achievement = createWeeklyAchievementFixture({
      id,
      achievedAt: Temporal.Instant.from("2027-01-08T12:00:00.123Z"),
    });

    // When
    await repository.saveAll([achievement]);
    const found = await repository.findByWeek({
      userId: achievement.userId,
      isoWeek: achievement.isoWeek,
    });

    // Then
    expect(found?.toPrimitives()).toEqual(achievement.toPrimitives());
  });
});

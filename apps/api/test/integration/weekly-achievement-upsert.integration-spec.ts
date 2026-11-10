import { asc, eq } from "drizzle-orm";

import { WeeklyAchievement } from "#api/modules/insights/weekly-achievements/domain/weekly-achievement.entity";
import { DrizzleWeeklyAchievementRepository } from "#api/modules/insights/weekly-achievements/infrastructure/persistence/drizzle-weekly-achievement.repository";
import { user, weeklyAchievement } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("주간 달성 일괄 upsert (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 4 }) });
  let client: TestDatabaseClient;
  let repository: DrizzleWeeklyAchievementRepository;
  let userId: string;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const fixture = UserFixture.create();
    await client.insert(user).values({ ...fixture, status: "ACTIVE" });
    userId = fixture.id;
    repository = new DrizzleWeeklyAchievementRepository(
      createDatabaseTransactionFixture(client).txHost,
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  let nextId = 0;
  function snapshot(
    week: number,
    completedTodos: number,
    achievedAt = Temporal.Instant.from("2027-02-01T00:00:00Z"),
  ) {
    nextId += 1;
    return WeeklyAchievement.reconstitute({
      id: nextId,
      userId,
      year: 2027,
      week,
      totalTodos: 5,
      completedTodos,
      achievedAt,
    });
  }

  function rows() {
    return client
      .select({
        week: weeklyAchievement.week,
        completedTodos: weeklyAchievement.completedTodos,
        achievedAt: weeklyAchievement.achievedAt,
      })
      .from(weeklyAchievement)
      .where(eq(weeklyAchievement.userId, userId))
      .orderBy(asc(weeklyAchievement.week));
  }

  it("여러 주차를 한 번에 저장하고 같은 주차는 갱신하며 행 id는 유지한다", async () => {
    await repository.saveAll([snapshot(1, 2), snapshot(2, 3)]);
    const [first] = await client
      .select({ id: weeklyAchievement.id })
      .from(weeklyAchievement)
      .where(eq(weeklyAchievement.week, 1));

    const later = Temporal.Instant.from("2027-02-08T00:00:00Z");
    await repository.saveAll([snapshot(1, 5, later), snapshot(3, 1)]);

    expect(await rows()).toEqual([
      { week: 1, completedTodos: 5, achievedAt: later },
      { week: 2, completedTodos: 3, achievedAt: Temporal.Instant.from("2027-02-01T00:00:00Z") },
      { week: 3, completedTodos: 1, achievedAt: Temporal.Instant.from("2027-02-01T00:00:00Z") },
    ]);
    const [again] = await client
      .select({ id: weeklyAchievement.id })
      .from(weeklyAchievement)
      .where(eq(weeklyAchievement.week, 1));
    expect(again?.id).toBe(first?.id);
  });
});

import { omit } from "es-toolkit";

import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { describeSchedulerPreferenceReaderContract } from "#test/contracts/notification/scheduler-preference-reader.contract";
import {
  describeWeeklyAchievementStatsReaderContract,
  type WeeklyStatsUserSeed,
} from "#test/contracts/notification/weekly-achievement-stats-reader.contract";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSchedulerReader 주간 달성 집계·설정 조회 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let sequence = 0;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  // 활성 시간대는 캐시를 거치므로 계약 사례마다 새 캐시로 만든다
  function createReader(): DrizzleSchedulerReader {
    return new DrizzleSchedulerReader(
      createDatabaseTransactionFixture(client).txHost,
      new CacheService(new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 })),
      { onboardingV2: { enabled: false, treatmentPercent: 50 } },
    );
  }

  async function insertUser(seed: Pick<WeeklyStatsUserSeed, "plan"> = {}): Promise<string> {
    sequence += 1;
    const user = UserFixture.create({
      id: createEntityId(),
      email: `scheduler-${sequence}@example.com`,
      userTag: `SCHED${String(sequence).padStart(3, "0")}`,
      role: seed.plan === "ADMIN" ? "ADMIN" : "USER",
      subscriptionStatus: seed.plan === "PREMIUM" ? "ACTIVE" : "FREE",
    });
    await client.insert(userTable).values(user);
    return user.id;
  }

  async function givenWeeklyStatsUser(seed: WeeklyStatsUserSeed): Promise<string> {
    const userId = await insertUser(seed);
    await client.insert(userPreference).values({ userId, timezone: seed.timezone });
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    for (const span of seed.todos ?? []) {
      await client.insert(todo).values({
        ...omit(TodoFixture.create({ userId, categoryId: category?.id ?? 0 }), ["id"]),
        startDate: Temporal.PlainDate.from(span.start),
        endDate: span.end == null ? null : Temporal.PlainDate.from(span.end),
        completed: span.completed ?? false,
      });
    }
    return userId;
  }

  describeWeeklyAchievementStatsReaderContract(async () => ({
    reader: createReader(),
    givenUser: givenWeeklyStatsUser,
  }));

  describeSchedulerPreferenceReaderContract(async () => ({
    reader: createReader(),
    givenPreference: async ({ timezone, locale }) => {
      const userId = await insertUser();
      await client.insert(userPreference).values({ userId, timezone, locale });
      return userId;
    },
    givenUserWithoutPreference: () => insertUser(),
  }));
});

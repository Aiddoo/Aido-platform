import { omit } from "es-toolkit";

import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  user as userTable,
  userLocation,
  userPreference,
} from "#api/platform/database/schema/index";
import { describeSchedulerPreferenceReaderContract } from "#test/contracts/notification/scheduler-preference-reader.contract";
import {
  describeWeeklyAchievementStatsReaderContract,
  type WeeklyStatsUserSeed,
} from "#test/contracts/notification/weekly-achievement-stats-reader.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
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
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 }),
      { onboardingV2: { enabled: false, treatmentPercent: 50 } },
      new DateClock(),
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

  describe("같은 현지 시각 시간대 묶음 조회", () => {
    const TODAY = Temporal.PlainDate.from("2026-11-10");
    const TOMORROW = TODAY.add({ days: 1 });
    const GROUP = ["Asia/Seoul", "Asia/Tokyo"] as const;

    // 묶음 시간대 사용자 둘과 밖의 사용자 하나. 오늘 할 일은 사용자마다 개수를 달리 둔다
    async function givenUsersAcrossTimezones() {
      const seeds = [
        { timezone: "Asia/Seoul", plan: "PREMIUM", todayTodos: 2 },
        { timezone: "Asia/Tokyo", plan: "PREMIUM", todayTodos: 1 },
        { timezone: "America/New_York", plan: "PREMIUM", todayTodos: 3 },
        { timezone: "Asia/Seoul", plan: "FREE", todayTodos: 0 },
        { timezone: "Asia/Tokyo", plan: "FREE", todayTodos: 1 },
      ] as const;
      const ids: string[] = [];
      for (const seed of seeds) {
        const userId = await insertUser({ plan: seed.plan });
        await client.insert(userPreference).values({
          userId,
          timezone: seed.timezone,
          weatherMorningHour: 8,
          weatherMorningMinute: 0,
        });
        await client.insert(userLocation).values({
          userId,
          latitude: 37.5,
          longitude: 127,
          updatedAt: Temporal.Now.instant(),
        });
        const [category] = await client
          .insert(todoCategory)
          .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
          .returning();
        for (let index = 0; index < seed.todayTodos; index += 1) {
          await client.insert(todo).values({
            ...omit(TodoFixture.create({ userId, categoryId: category?.id ?? 0 }), ["id"]),
            startDate: TODAY,
            endDate: null,
          });
        }
        ids.push(userId);
      }
      return ids;
    }

    const byId = <TRow extends { readonly id: string }>(rows: readonly TRow[]) =>
      rows.toSorted((left, right) => left.id.localeCompare(right.id));

    it("시간대 목록을 in으로 한 번 읽은 결과는 시간대마다 읽은 결과의 합과 같다", async () => {
      // Given
      await givenUsersAcrossTimezones();
      const reader = createReader();
      const reads = {
        premiumMorning: (timezones: readonly string[]) =>
          reader.findPremiumMorningReminderUsers({
            timezones,
            hour: 8,
            minute: 0,
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        freeMorning: (timezones: readonly string[]) =>
          reader.findFreeMorningReminderUsers({ timezones, today: TODAY, tomorrow: TOMORROW }),
        premiumEvening: (timezones: readonly string[]) =>
          reader.findPremiumEveningReminderUsers({
            timezones,
            hour: 19,
            minute: 0,
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        lunchNudge: (timezones: readonly string[]) =>
          reader.findLunchNudgeUsers({ timezones, today: TODAY, tomorrow: TOMORROW }),
        weatherMorning: (timezones: readonly string[]) =>
          reader.findWeatherMorningUsersWithLocation({ timezones, hour: 8, minute: 0 }),
        activeUsers: (timezones: readonly string[]) => reader.findActiveUsersInTimezones(timezones),
      };

      for (const [name, read] of Object.entries(reads)) {
        // When
        const grouped = await read(GROUP);
        const perTimezone = (await Promise.all(GROUP.map((timezone) => read([timezone])))).flat();

        // Then
        expect(byId(grouped), name).toEqual(byId(perTimezone));
        expect(grouped.length, name).toBeGreaterThan(0);
      }
    });

    it("행마다 사용자 자신의 시간대와 오늘 할 일 수를 싣는다", async () => {
      // Given
      const [seoul, tokyo] = await givenUsersAcrossTimezones();
      const reader = createReader();

      // When
      const morning = await reader.findPremiumMorningReminderUsers({
        timezones: GROUP,
        hour: 8,
        minute: 0,
        today: TODAY,
        tomorrow: TOMORROW,
      });
      const evening = await reader.findPremiumEveningReminderUsers({
        timezones: GROUP,
        hour: 19,
        minute: 0,
        today: TODAY,
        tomorrow: TOMORROW,
      });
      const weather = await reader.findWeatherMorningUsersWithLocation({
        timezones: GROUP,
        hour: 8,
        minute: 0,
      });

      // Then
      expect(byId(morning).map(({ id, _count }) => [id, _count.todos])).toEqual(
        byId([
          { id: seoul ?? "", _count: { todos: 2 } },
          { id: tokyo ?? "", _count: { todos: 1 } },
        ]).map(({ id, _count }) => [id, _count.todos]),
      );
      expect(byId(evening).map(({ id, timezone }) => [id, timezone])).toEqual(
        byId([
          { id: seoul ?? "", timezone: "Asia/Seoul" },
          { id: tokyo ?? "", timezone: "Asia/Tokyo" },
        ]).map(({ id, timezone }) => [id, timezone]),
      );
      expect(new Set(weather.map(({ timezone }) => timezone))).toEqual(new Set(GROUP));
    });
  });

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

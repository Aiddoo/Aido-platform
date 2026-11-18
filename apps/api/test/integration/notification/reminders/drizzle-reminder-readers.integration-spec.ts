import { eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import {
  todo,
  todoCategory,
  user as userTable,
  userLocation,
  userPreference,
  userProfile,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { describeSchedulerPreferenceReaderContract } from "#test/contracts/notification/scheduler-preference-reader.contract";
import {
  describeWeeklyAchievementStatsReaderContract,
  type WeeklyStatsUserSeed,
} from "#test/contracts/notification/weekly-achievement-stats-reader.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createTodoCategoryRowFixture,
  createTodoRowFixture,
} from "#test/fixtures/planning/todo-row.fixture";
import { createSchedulerReaders } from "#test/integration/helpers/scheduler-readers";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("리마인더 Drizzle reader 주간 달성 집계·설정 조회 (실제 PostgreSQL)", () => {
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
  function createReader(): ReturnType<typeof createSchedulerReaders> {
    return createSchedulerReaders({
      transactionHost: createDatabaseTransactionFixture(client).transactionHost,
      cache: new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 }),
      clock: new DateClock(),
    });
  }

  async function insertUser(seed: Pick<WeeklyStatsUserSeed, "plan"> = {}): Promise<string> {
    sequence += 1;
    const user = createUserRowFixture({
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
      .values(omit(createTodoCategoryRowFixture({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    for (const span of seed.todos ?? []) {
      await client.insert(todo).values({
        ...omit(createTodoRowFixture({ userId, categoryId: category?.id ?? 0 }), ["id"]),
        startDate: Temporal.PlainDate.from(span.start),
        endDate: span.end == null ? null : Temporal.PlainDate.from(span.end),
        completed: span.completed ?? false,
      });
    }
    return userId;
  }

  describe("재유입 대상 조회", () => {
    const TODAY = Temporal.PlainDate.from("2026-11-10");
    const TOMORROW = TODAY.add({ days: 1 });
    const today = TODAY.toString();

    async function givenReEngagementUser(seed: {
      readonly timezone: string;
      readonly lastActiveAt?: string;
      readonly currentStreak?: number;
      readonly profileName?: string | null;
      readonly todos?: readonly { readonly start: string; readonly completed?: boolean }[];
    }): Promise<string> {
      const userId = await givenWeeklyStatsUser({
        timezone: seed.timezone,
        todos: (seed.todos ?? []).map((span) => ({ ...span, end: null })),
      });
      if (seed.lastActiveAt != null) {
        await client
          .update(userTable)
          .set({ lastActiveAt: Temporal.Instant.from(seed.lastActiveAt) })
          .where(eq(userTable.id, userId));
      }
      if (seed.currentStreak != null) {
        await client
          .update(userPreference)
          .set({ currentStreak: seed.currentStreak })
          .where(eq(userPreference.userId, userId));
      }
      if (seed.profileName !== undefined) {
        await client.insert(userProfile).values({ userId, name: seed.profileName });
      }
      return userId;
    }

    it("윈백 대상은 시간대 묶음과 마지막 활동 구간에 드는 사람이고 각자 시간대를 함께 준다", async () => {
      // Given
      const inside = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        lastActiveAt: "2026-11-01T00:00:00Z",
      });
      await givenReEngagementUser({ timezone: "Asia/Seoul", lastActiveAt: "2026-11-09T00:00:00Z" });
      await givenReEngagementUser({
        timezone: "America/New_York",
        lastActiveAt: "2026-11-01T00:00:00Z",
      });

      // When
      const users = await createReader().reEngagement.findWinbackUsers({
        timezones: ["Asia/Seoul"],
        inactiveSince: Temporal.Instant.from("2026-10-10T00:00:00Z"),
        inactiveUntil: Temporal.Instant.from("2026-11-07T00:00:00Z"),
      });

      // Then
      expect(users).toEqual([
        {
          id: inside,
          lastActiveAt: Temporal.Instant.from("2026-11-01T00:00:00Z"),
          timezone: "Asia/Seoul",
        },
      ]);
    });

    it("연속 기록 위기 대상은 3일 이상 이어 왔고 오늘 끝내지 않은 할 일이 있는 사람이다", async () => {
      // Given
      const atRisk = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        currentStreak: 5,
        todos: [{ start: today }, { start: today, completed: true }],
      });
      await givenReEngagementUser({
        timezone: "Asia/Seoul",
        currentStreak: 2,
        todos: [{ start: today }],
      });
      await givenReEngagementUser({
        timezone: "Asia/Seoul",
        currentStreak: 5,
        todos: [{ start: today, completed: true }],
      });

      // When
      const users = await createReader().reEngagement.findStreakAtRiskUsers({
        timezones: ["Asia/Seoul"],
        today: TODAY,
        tomorrow: TOMORROW,
      });

      // Then
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        id: atRisk,
        preference: { currentStreak: 5, lastCompletedDate: null, locale: "ko" },
      });
      expect(users[0]?.todos.map(({ completed }) => completed).toSorted()).toEqual([false, true]);
    });

    it("소셜 다이제스트 후보는 받은 사람 중 오늘 끝내지 않은 할 일이 있는 사람이다", async () => {
      // Given
      const candidate = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [{ start: today }],
      });
      const done = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [{ start: today, completed: true }],
      });
      const notRecipient = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [{ start: today }],
      });

      // When
      const users = await createReader().reEngagement.findSocialDigestCandidates({
        timezones: ["Asia/Seoul"],
        today: TODAY,
        tomorrow: TOMORROW,
        recipientUserIds: [UserId.reconstitute(candidate), UserId.reconstitute(done)],
      });

      // Then
      expect(users).toEqual([{ id: candidate, todos: [{ completed: false }] }]);
      expect(users.map(({ id }) => id)).not.toContain(notRecipient);
    });

    it("오늘 할 일이 있는 친구는 프로필 이름(없으면 null)과 오늘 할 일 완료 여부를 준다", async () => {
      // Given
      const named = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        profileName: "친구",
        todos: [{ start: today, completed: true }],
      });
      const withoutProfile = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [{ start: today }],
      });
      const idle = await givenReEngagementUser({ timezone: "Asia/Seoul", profileName: "쉼" });

      // When
      const friends = await createReader().reEngagement.findFriendsWithTodayTodos({
        friendIds: [
          UserId.reconstitute(named),
          UserId.reconstitute(withoutProfile),
          UserId.reconstitute(idle),
        ],
        today: TODAY,
        tomorrow: TOMORROW,
      });

      // Then
      expect(friends.toSorted((left, right) => left.id.localeCompare(right.id))).toEqual(
        [
          { id: named, profile: { name: "친구" }, todos: [{ completed: true }] },
          { id: withoutProfile, profile: null, todos: [{ completed: false }] },
        ].toSorted((left, right) => left.id.localeCompare(right.id)),
      );
    });

    it("끝낸 할 일 수는 사람마다 숫자로 주고 끝낸 할 일이 없는 사람은 뺀다", async () => {
      // Given
      const busy = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [
          { start: today, completed: true },
          { start: "2026-11-01", completed: true },
          { start: today },
        ],
      });
      const idle = await givenReEngagementUser({
        timezone: "Asia/Seoul",
        todos: [{ start: today }],
      });

      // When
      const counts = await createReader().reEngagement.countCompletedTodosByUsers([
        UserId.reconstitute(busy),
        UserId.reconstitute(idle),
      ]);

      // Then
      expect(counts).toEqual([{ userId: busy, count: 2 }]);
      expect(typeof counts[0]?.count).toBe("number");
    });
  });

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
          .values(omit(createTodoCategoryRowFixture({ userId, sortOrder: 0 }), ["id"]))
          .returning();
        for (let index = 0; index < seed.todayTodos; index += 1) {
          await client.insert(todo).values({
            ...omit(createTodoRowFixture({ userId, categoryId: category?.id ?? 0 }), ["id"]),
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
          reader.scheduledReminder.findPremiumMorningReminderUsers({
            timezones,
            times: [{ hour: 8, minute: 0 }],
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        freeMorning: (timezones: readonly string[]) =>
          reader.scheduledReminder.findFreeMorningReminderUsers({
            timezones,
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        premiumEvening: (timezones: readonly string[]) =>
          reader.scheduledReminder.findPremiumEveningReminderUsers({
            timezones,
            times: [{ hour: 19, minute: 0 }],
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        lunchNudge: (timezones: readonly string[]) =>
          reader.scheduledReminder.findLunchNudgeUsers({
            timezones,
            today: TODAY,
            tomorrow: TOMORROW,
          }),
        weatherMorning: (timezones: readonly string[]) =>
          reader.weatherReminder.findWeatherMorningUsersWithLocation({
            timezones,
            times: [{ hour: 8, minute: 0 }],
          }),
        activeUsers: (timezones: readonly string[]) =>
          reader.reEngagement.findActiveUsersInTimezones(timezones),
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
      const morning = await reader.scheduledReminder.findPremiumMorningReminderUsers({
        timezones: GROUP,
        times: [{ hour: 8, minute: 0 }],
        today: TODAY,
        tomorrow: TOMORROW,
      });
      const evening = await reader.scheduledReminder.findPremiumEveningReminderUsers({
        timezones: GROUP,
        times: [{ hour: 19, minute: 0 }],
        today: TODAY,
        tomorrow: TOMORROW,
      });
      const weather = await reader.weatherReminder.findWeatherMorningUsersWithLocation({
        timezones: GROUP,
        times: [{ hour: 8, minute: 0 }],
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
    reader: createReader().weeklyAchievementStats,
    givenUser: givenWeeklyStatsUser,
  }));

  describeSchedulerPreferenceReaderContract(async () => ({
    reader: createReader().schedulerPreference,
    givenPreference: async ({ timezone, locale }) => {
      const userId = await insertUser();
      await client.insert(userPreference).values({ userId, timezone, locale });
      return userId;
    },
    givenUserWithoutPreference: () => insertUser(),
  }));
});

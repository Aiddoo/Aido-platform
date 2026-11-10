import { eq, sql } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";

import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { DrizzleGrowthMetricsReader } from "#api/modules/operations/metrics/infrastructure/persistence/drizzle-growth-metrics.reader";
import { requireRecord } from "#api/platform/database/database-error.util";
import {
  account,
  todo,
  todoCategory,
  user as userTable,
  userActivityDay,
} from "#api/platform/database/schema/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "../setup/test-database.js";

// 테스트가 vi.setSystemTime으로 고정한 시각을 그대로 활동 시각으로 쓴다
function seenNow(): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(Date.now());
}

describe("성장 지표 통합 테스트 (실제 DB)", () => {
  let testDb: TestDatabase;
  let client: TestDatabaseClient;
  let activityWriter: DrizzleUserRepository;
  let growthMetrics: DrizzleGrowthMetricsReader;

  beforeAll(async () => {
    testDb = new TestDatabase();
    client = await testDb.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    activityWriter = new DrizzleUserRepository(txHost);
    growthMetrics = new DrizzleGrowthMetricsReader(txHost);
  }, 60_000);

  beforeEach(async () => {
    await testDb.cleanup();
  });

  afterAll(async () => {
    await testDb.stop();
  });

  it("현지 날짜 upsert가 firstSeenAt을 보존하고 병렬 writer에도 한 행만 남긴다", async () => {
    // Given
    await client.insert(userTable).values({
      id: "activity-user",
      email: "activity@example.com",
      userTag: "ACT00001",
      status: "ACTIVE",
    });

    // When
    await activityWriter.updateLastActiveAt({
      userId: "activity-user",
      timezone: "Asia/Seoul",
      seenAt: seenNow(),
    });
    const first = await client.query.userActivityDay.findFirst({
      where: { userId: "activity-user" },
    });
    const preservedFirstSeenAt = new Date("2025-01-01T00:00:00.000Z");
    await client
      .update(userActivityDay)
      .set({ firstSeenAt: preservedFirstSeenAt, lastSeenAt: preservedFirstSeenAt })
      .where(eq(userActivityDay.id, requireRecord(first).id));
    await Promise.all(
      Array.from({ length: 6 }, () =>
        activityWriter.updateLastActiveAt({
          userId: "activity-user",
          timezone: "Asia/Seoul",
          seenAt: seenNow(),
        }),
      ),
    );

    // Then
    const rows = await client
      .select()
      .from(userActivityDay)
      .where(eq(userActivityDay.userId, "activity-user"));
    const user = requireRecord(
      await client.query.user.findFirst({ where: { id: "activity-user" } }),
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toBeDefined();
    if (!row) {
      return;
    }
    const expectedLocalDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(row.lastSeenAt);
    expect(row.localDate.toISOString().slice(0, 10)).toBe(expectedLocalDate);
    expect(row.firstSeenAt).toEqual(preservedFirstSeenAt);
    expect(row.lastSeenAt.getTime()).toBeGreaterThan(preservedFirstSeenAt.getTime());
    expect(user.lastActiveAt).toEqual(row.lastSeenAt);
  });

  it("늦게 커밋된 과거 활동이 최신 사용자·활동 시각을 되돌리지 않는다", async () => {
    // Given
    await client.insert(userTable).values({
      id: "out-of-order-user",
      email: "out-of-order@example.com",
      userTag: "ACT00002",
      status: "ACTIVE",
    });
    const otherWriter = createActivityWriter(client);
    const earlier = new Date("2026-07-26T15:10:00.000Z");
    const later = new Date("2026-07-26T15:30:00.000Z");
    vi.useFakeTimers({
      toNotFake: ["nextTick", "setImmediate", "setInterval", "setTimeout"],
    });

    try {
      // When
      vi.setSystemTime(later);
      await activityWriter.updateLastActiveAt({
        userId: "out-of-order-user",
        timezone: "Asia/Seoul",
        seenAt: seenNow(),
      });
      vi.setSystemTime(earlier);
      await otherWriter.updateLastActiveAt({
        userId: "out-of-order-user",
        timezone: "Asia/Seoul",
        seenAt: seenNow(),
      });
    } finally {
      vi.useRealTimers();
    }

    // Then
    const row = requireRecord(
      await client.query.userActivityDay.findFirst({ where: { userId: "out-of-order-user" } }),
    );
    const user = requireRecord(
      await client.query.user.findFirst({ where: { id: "out-of-order-user" } }),
    );
    expect(row.firstSeenAt).toEqual(earlier);
    expect(row.lastSeenAt).toEqual(later);
    expect(user.lastActiveAt).toEqual(later);
  });

  it("병렬 최초 insert 충돌에서도 첫·마지막 활동 시각의 극값을 남긴다", async () => {
    // Given
    await client.insert(userTable).values({
      id: "parallel-insert-user",
      email: "parallel-insert@example.com",
      userTag: "ACT00003",
      status: "ACTIVE",
    });
    const otherWriter = createActivityWriter(client);
    const earlier = new Date("2026-07-26T16:10:00.000Z");
    const later = new Date("2026-07-26T16:30:00.000Z");
    vi.useFakeTimers({
      toNotFake: ["nextTick", "setImmediate", "setInterval", "setTimeout"],
    });

    try {
      // When
      vi.setSystemTime(earlier);
      const earlierWrite = activityWriter.updateLastActiveAt({
        userId: "parallel-insert-user",
        timezone: "Asia/Seoul",
        seenAt: seenNow(),
      });
      vi.setSystemTime(later);
      const laterWrite = otherWriter.updateLastActiveAt({
        userId: "parallel-insert-user",
        timezone: "Asia/Seoul",
        seenAt: seenNow(),
      });
      await Promise.all([earlierWrite, laterWrite]);
    } finally {
      vi.useRealTimers();
    }

    // Then
    const row = requireRecord(
      await client.query.userActivityDay.findFirst({ where: { userId: "parallel-insert-user" } }),
    );
    const user = requireRecord(
      await client.query.user.findFirst({ where: { id: "parallel-insert-user" } }),
    );
    expect(row.firstSeenAt).toEqual(earlier);
    expect(row.lastSeenAt).toEqual(later);
    expect(user.lastActiveAt).toEqual(later);
  });

  it("가입 현지 날짜, 측정 시작, 성숙 cohort, DAU/WAU/MAU를 집계한다", async () => {
    // Given
    await seedGrowthScenario(client);

    // When
    const result = await growthMetrics.getSummaryCounts({
      cohortFrom: Temporal.PlainDate.from("2026-06-01"),
      cohortTo: Temporal.PlainDate.from("2026-07-30"),
      asOf: Temporal.Instant.from("2026-07-31T12:00:00Z"),
    });

    // Then
    expect(result.measurementStartedAt?.toString()).toBe("2026-06-01T00:00:00Z");
    expect({ ...result, measurementStartedAt: null }).toEqual({
      measurementStartedAt: null,
      totalActiveUsers: 4,
      signups: 4,
      dau: 0,
      wau: 1,
      mau: 2,
      activationEligible: 4,
      activationAchieved: 2,
      d1Eligible: 3,
      d1Achieved: 3,
      d7Eligible: 3,
      d7Achieved: 2,
      d30Eligible: 2,
      d30Achieved: 1,
      d7RetainedActivatedUsers: 2,
    });
  });

  it("삭제된 사용자는 성장·활성·리텐션의 어떤 집계에도 포함하지 않는다", async () => {
    // Given
    await seedGrowthScenario(client);
    await seedDeletedGrowthUser(client);

    // When
    const result = await growthMetrics.getSummaryCounts({
      cohortFrom: Temporal.PlainDate.from("2026-06-01"),
      cohortTo: Temporal.PlainDate.from("2026-07-30"),
      asOf: Temporal.Instant.from("2026-07-31T12:00:00Z"),
    });

    // Then
    expect(result.measurementStartedAt?.toString()).toBe("2026-06-01T00:00:00Z");
    expect({ ...result, measurementStartedAt: null }).toEqual({
      measurementStartedAt: null,
      totalActiveUsers: 4,
      signups: 4,
      dau: 0,
      wau: 1,
      mau: 2,
      activationEligible: 4,
      activationAchieved: 2,
      d1Eligible: 3,
      d1Achieved: 3,
      d7Eligible: 3,
      d7Achieved: 2,
      d30Eligible: 2,
      d30Achieved: 1,
      d7RetainedActivatedUsers: 2,
    });
  });

  it("측정 시작과 cohort 후보 범위를 위한 성장 지표 인덱스를 제공한다", async () => {
    // When
    const { rows } = await client.execute<{ indexdef: string }>(sql`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('User', 'UserActivityDay')
    `);
    const indexes = z.array(z.object({ indexdef: z.string() })).parse(rows);

    // Then
    expect(indexes.map(({ indexdef }) => indexdef)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ON public."UserActivityDay" USING btree ("firstSeenAt")'),
        expect.stringContaining('ON public."User" USING btree ("deletedAt", "createdAt")'),
      ]),
    );
  });
});

function createActivityWriter(client: TestDatabaseClient): DrizzleUserRepository {
  return new DrizzleUserRepository(createDatabaseTransactionFixture(client).txHost);
}

async function seedGrowthScenario(client: TestDatabaseClient): Promise<void> {
  const users = [
    {
      id: "pre-measurement",
      email: "pre@example.com",
      userTag: "GROW0001",
      createdAt: new Date("2026-05-31T12:00:00.000Z"),
    },
    {
      id: "activated-retained",
      email: "activated@example.com",
      userTag: "GROW0002",
      createdAt: new Date("2026-06-01T15:30:00.000Z"),
    },
    {
      id: "not-activated",
      email: "inactive@example.com",
      userTag: "GROW0003",
      createdAt: new Date("2026-06-10T10:00:00.000Z"),
    },
    {
      id: "immature-d30",
      email: "immature@example.com",
      userTag: "GROW0004",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
    },
  ];
  await client.insert(userTable).values([
    ...users.map((user) => ({ ...user, status: "ACTIVE" as const })),
    {
      ...DELETED_COMMENT_AUTHOR,
      status: "LOCKED" as const,
      createdAt: new Date("2026-06-05T00:00:00.000Z"),
    },
  ]);
  await client.insert(account).values(
    users.map((user) => ({
      userId: user.id,
      provider: "CREDENTIAL" as const,
      providerAccountId: `growth-${user.id}`,
      updatedAt: Temporal.Now.instant(),
    })),
  );
  await client
    .insert(userActivityDay)
    .values([
      activity("pre-measurement", "2026-06-02", "Pacific/Kiritimati", "2026-06-01T00:00:00.000Z"),
      activity("activated-retained", "2026-06-02", "Asia/Seoul", "2026-06-02T01:00:00.000Z"),
      activity("activated-retained", "2026-06-03", "Asia/Seoul", "2026-06-03T01:00:00.000Z"),
      activity("activated-retained", "2026-06-09", "Asia/Seoul", "2026-06-09T01:00:00.000Z"),
      activity("activated-retained", "2026-07-02", "Asia/Seoul", "2026-07-02T01:00:00.000Z"),
      activity("not-activated", "2026-06-11", "UTC", "2026-06-11T10:00:00.000Z"),
      activity("immature-d30", "2026-07-21", "UTC", "2026-07-21T10:00:00.000Z"),
      activity("immature-d30", "2026-07-27", "UTC", "2026-07-27T10:00:00.000Z"),
    ]);

  await client
    .insert(todoCategory)
    .values(
      users.map((user) => ({ userId: user.id, name: `category-${user.id}`, color: "#000000" })),
    );
  const categories = await client
    .select({ id: todoCategory.id, userId: todoCategory.userId })
    .from(todoCategory);
  const categoryByUser = new Map(categories.map((row) => [row.userId, row.id]));
  const activatedCategory = categoryByUser.get("activated-retained");
  const immatureCategory = categoryByUser.get("immature-d30");
  if (!activatedCategory || !immatureCategory) {
    throw new Error("growth fixture categories were not created");
  }
  const activatedSignup = users[1]?.createdAt;
  const immatureSignup = users[3]?.createdAt;
  if (!activatedSignup || !immatureSignup) {
    throw new Error("growth fixture users were not created");
  }
  await client.insert(todo).values([
    {
      userId: "activated-retained",
      categoryId: activatedCategory,
      title: "created within window",
      startDate: new Date("2026-06-02T00:00:00.000Z"),
      createdAt: new Date(activatedSignup.getTime() + 60 * 60 * 1000),
      completed: false,
    },
    {
      userId: "activated-retained",
      categoryId: activatedCategory,
      title: "completed within window",
      startDate: new Date("2026-06-02T00:00:00.000Z"),
      createdAt: new Date(activatedSignup.getTime() - 60 * 60 * 1000),
      completed: true,
      completedAt: new Date(activatedSignup.getTime() + 2 * 60 * 60 * 1000),
    },
    {
      userId: "immature-d30",
      categoryId: immatureCategory,
      title: "activated",
      startDate: new Date("2026-07-20T00:00:00.000Z"),
      createdAt: new Date(immatureSignup.getTime() + 60 * 60 * 1000),
      completed: true,
      completedAt: new Date(immatureSignup.getTime() + 2 * 60 * 60 * 1000),
    },
  ]);
}

async function seedDeletedGrowthUser(client: TestDatabaseClient): Promise<void> {
  const signupAt = new Date("2026-06-01T10:00:00.000Z");
  await client.insert(userTable).values({
    id: "deleted-growth-user",
    email: "deleted-growth@example.com",
    userTag: "GROW0005",
    status: "ACTIVE",
    createdAt: signupAt,
    deletedAt: new Date("2026-07-31T00:00:00.000Z"),
  });
  await client.insert(account).values({
    userId: "deleted-growth-user",
    provider: "CREDENTIAL",
    providerAccountId: "growth-deleted-growth-user",
    updatedAt: Temporal.Now.instant(),
  });
  const [category] = await client
    .insert(todoCategory)
    .values({ userId: "deleted-growth-user", name: "deleted-user-category", color: "#000000" })
    .returning();
  const categoryId = requireRecord(category).id;
  await client.insert(todo).values([
    {
      userId: "deleted-growth-user",
      categoryId,
      title: "deleted created",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date(signupAt.getTime() + 60 * 60 * 1000),
      completed: false,
    },
    {
      userId: "deleted-growth-user",
      categoryId,
      title: "deleted completed",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: signupAt,
      completed: true,
      completedAt: new Date(signupAt.getTime() + 2 * 60 * 60 * 1000),
    },
  ]);
  await client
    .insert(userActivityDay)
    .values([
      activity("deleted-growth-user", "2026-06-02", "UTC", "2026-06-02T10:00:00.000Z"),
      activity("deleted-growth-user", "2026-06-08", "UTC", "2026-06-08T10:00:00.000Z"),
      activity("deleted-growth-user", "2026-07-01", "UTC", "2026-07-01T10:00:00.000Z"),
      activity("deleted-growth-user", "2026-07-30", "UTC", "2026-07-30T10:00:00.000Z"),
    ]);
}

function activity(userId: string, localDate: string, timezone: string, seenAt: string) {
  const timestamp = new Date(seenAt);
  return {
    userId,
    localDate: new Date(`${localDate}T00:00:00.000Z`),
    timezone,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
  };
}

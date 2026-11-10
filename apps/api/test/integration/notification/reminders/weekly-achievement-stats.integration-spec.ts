import { ConfigService } from "@nestjs/config";
import { omit } from "es-toolkit";

import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import type { EnvConfig } from "#api/platform/config/schemas/index";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SEOUL = "Asia/Seoul";
const LOS_ANGELES = "America/Los_Angeles";
// 월요일 2026-11-02 ~ 일요일 2026-11-08, 끝은 다음 월요일(배타)
const PERIOD = {
  periodStart: parseDateOnly("2026-11-02"),
  periodEnd: parseDateOnly("2026-11-09"),
};

interface TodoSpan {
  readonly start: string;
  readonly end: string | null;
  readonly completed?: boolean;
}

describe("주간 달성 집계의 여러 날 할 일 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let reader: DrizzleSchedulerReader;
  let sequence = 0;

  beforeAll(async () => {
    client = await database.start();
    reader = new DrizzleSchedulerReader(
      createDatabaseTransactionFixture(client).txHost,
      new CacheService(new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 })),
      new TypedConfigService(new ConfigService<EnvConfig, true>({})),
    );
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  async function givenUser(timezone: string, spans: readonly TodoSpan[]): Promise<string> {
    sequence += 1;
    const user = UserFixture.create({
      id: createEntityId(),
      email: `weekly-${sequence}@example.com`,
      userTag: `WEEKLY${sequence}`,
    });
    await client.insert(userTable).values(user);
    await client.insert(userPreference).values({ userId: user.id, timezone });
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: user.id, sortOrder: 0 }), ["id"]))
      .returning();
    for (const span of spans) {
      await client.insert(todo).values({
        ...omit(TodoFixture.create({ userId: user.id, categoryId: category?.id ?? 0 }), ["id"]),
        startDate: parseDateOnly(span.start),
        endDate: span.end == null ? null : parseDateOnly(span.end),
        completed: span.completed ?? false,
      });
    }
    return user.id;
  }

  async function countsFor(timezone: string) {
    const [total, completed] = await Promise.all([
      reader.groupTotalTodosByUser({ tz: timezone, ...PERIOD }),
      reader.groupCompletedTodosByUser({ tz: timezone, ...PERIOD }),
    ]);
    return {
      total: new Map(total.map((row) => [row.userId, row.count])),
      completed: new Map(completed.map((row) => [row.userId, row.count])),
    };
  }

  it.each([
    {
      name: "기간 시작 전에 끝난 할 일",
      span: { start: "2026-10-28", end: "2026-10-31" },
      days: 0,
    },
    { name: "시작 직전 일요일 하루짜리", span: { start: "2026-11-01", end: null }, days: 0 },
    {
      name: "기간 전에 시작해 기간 안으로 이어진 할 일",
      span: { start: "2026-10-30", end: "2026-11-03" },
      days: 2,
    },
    {
      name: "기간 마지막 날에 끝나는 할 일",
      span: { start: "2026-11-06", end: "2026-11-08" },
      days: 3,
    },
    {
      name: "기간 뒤까지 이어지는 할 일",
      span: { start: "2026-11-07", end: "2026-11-12" },
      days: 2,
    },
    {
      name: "일요일에서 다음 주 월요일로 넘어가는 할 일",
      span: { start: "2026-11-08", end: "2026-11-09" },
      days: 1,
    },
    { name: "다음 주 월요일에 시작하는 할 일", span: { start: "2026-11-09", end: null }, days: 0 },
    { name: "종료일이 없는 하루짜리", span: { start: "2026-11-04", end: null }, days: 1 },
    {
      name: "시작일과 종료일이 같은 하루짜리",
      span: { start: "2026-11-05", end: "2026-11-05" },
      days: 1,
    },
    {
      name: "몇 년에 걸친 할 일은 기간 안의 날만",
      span: { start: "2020-01-01", end: "2030-12-31" },
      days: 7,
    },
  ] as const)("$name은 기간 안의 날마다 $days번 센다", async ({ span, days }) => {
    // Given
    const userId = await givenUser(SEOUL, [{ ...span, completed: true }]);

    // When
    const counts = await countsFor(SEOUL);

    // Then
    expect(counts.total.get(userId) ?? 0).toBe(days);
    expect(counts.completed.get(userId) ?? 0).toBe(days);
  });

  it("한 사용자의 할 일들을 날마다 더하고 완료는 완료한 할 일의 날만 더한다", async () => {
    // Given
    const userId = await givenUser(SEOUL, [
      { start: "2026-10-30", end: "2026-11-03", completed: true },
      { start: "2026-11-06", end: "2026-11-08", completed: true },
      { start: "2026-11-07", end: "2026-11-12" },
      { start: "2026-11-04", end: null },
    ]);

    // When
    const counts = await countsFor(SEOUL);

    // Then
    expect(counts.total.get(userId)).toBe(2 + 3 + 2 + 1);
    expect(counts.completed.get(userId)).toBe(2 + 3);
  });

  it("서울과 로스앤젤레스 사용자는 각자의 시간대 집계에만 들어가고 같은 날짜 규칙을 쓴다", async () => {
    // Given
    const seoulUserId = await givenUser(SEOUL, [{ start: "2026-11-08", end: "2026-11-09" }]);
    const laUserId = await givenUser(LOS_ANGELES, [
      { start: "2026-11-01", end: "2026-11-02", completed: true },
    ]);

    // When
    const seoul = await countsFor(SEOUL);
    const losAngeles = await countsFor(LOS_ANGELES);

    // Then
    expect([...seoul.total]).toEqual([[seoulUserId, 1]]);
    expect([...seoul.completed]).toEqual([]);
    expect([...losAngeles.total]).toEqual([[laUserId, 1]]);
    expect([...losAngeles.completed]).toEqual([[laUserId, 1]]);
  });
});

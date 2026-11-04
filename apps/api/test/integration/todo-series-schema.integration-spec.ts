import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { TodoSeries } from "#api/modules/planning/domain/aggregates/series/todo-series.aggregate";
import { RepeatRule } from "#api/modules/planning/domain/value-objects/series/repeat-rule.vo";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/infrastructure/persistence/series/drizzle-todo-series.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  todoItem,
  todoSeries,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

function readDataMigrationStatements(): string[] {
  const folder = readdirSync(MIGRATIONS_DIR).find((name) => name.endsWith("_todo_series"));
  if (folder == null) {
    throw new Error("todo_series 마이그레이션 폴더 누락");
  }
  return readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) =>
      /^(-- [^\n]*\n)?(UPDATE "Todo"|INSERT INTO "TodoSeries")/.test(statement),
    );
}

describe("반복 할 일 스키마 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 4 }) });
  let client: TestDatabaseClient;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create({
      id: createEntityId(),
      email: "series-schema@example.com",
      userTag: "SERIES01",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    categoryId = category.id;
  });
  afterAll(async () => {
    await database.stop();
  });

  async function seedLegacy(
    seriesId: string | null,
    date: string,
    overrides: Partial<typeof todo.$inferInsert> = {},
  ) {
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId, categoryId, sortOrder: 0 }), ["id"]),
        title: "옛 반복",
        seriesId,
        occurrenceDate: null,
        startDate: new Date(`${date}T00:00:00.000Z`),
        ...overrides,
      })
      .returning();
    if (row == null) {
      throw new Error("Todo fixture 누락");
    }
    return row;
  }

  async function runDataMigration() {
    for (const statement of readDataMigrationStatements()) {
      await client.execute(sql.raw(statement));
    }
  }

  describe("기존 묶음 이관", () => {
    it("같은 날짜 중복은 최소 id만 남기고 묶음을 해제하고 회차 날짜를 채운다", async () => {
      // Given
      const kept = await seedLegacy("group-a", "2026-03-02");
      const duplicate = await seedLegacy("group-a", "2026-03-02");
      const other = await seedLegacy("group-a", "2026-03-04");
      const single = await seedLegacy(null, "2026-03-02");
      // When
      await runDataMigration();
      // Then
      const rows = await client.query.todo.findMany({ where: { userId }, orderBy: { id: "asc" } });
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(kept.id)?.seriesId).toBe("group-a");
      expect(byId.get(kept.id)?.occurrenceDate).toEqual(new Date("2026-03-02T00:00:00.000Z"));
      expect(byId.get(duplicate.id)).toMatchObject({ seriesId: null, occurrenceDate: null });
      expect(byId.get(other.id)?.occurrenceDate).toEqual(new Date("2026-03-04T00:00:00.000Z"));
      expect(byId.get(single.id)).toMatchObject({ seriesId: null, occurrenceDate: null });
    });

    it("묶음마다 끝난 규칙을 만들고 첫 행의 내용과 실제 날짜 요일을 옮긴다", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "Asia/Seoul" });
      const first = await seedLegacy("group-b", "2026-03-02", {
        title: "월수 반복",
        visibility: "PRIVATE",
        sortOrder: 7,
        scheduledTime: new Date("2026-03-02T00:30:00.000Z"),
        isAllDay: false,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      });
      await seedLegacy("group-b", "2026-03-04", { sortOrder: 8 });
      await client.insert(todoItem).values([
        { todoId: first.id, title: "둘째", sortOrder: 1 },
        { todoId: first.id, title: "첫째", sortOrder: 0 },
      ]);
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-b" } });
      expect(series).toMatchObject({
        userId,
        categoryId,
        title: "월수 반복",
        visibility: "PRIVATE",
        scheduledLocalTime: "09:30",
        timezone: "Asia/Seoul",
        repeatFrequency: "WEEKLY",
        repeatInterval: 1,
        repeatWeekdays: ["MON", "WED"],
        repeatMonthDay: null,
        repeatCount: null,
        startDate: new Date("2026-03-02T00:00:00.000Z"),
        repeatUntil: new Date("2026-03-04T00:00:00.000Z"),
        nextOccurrenceDate: null,
        generatedCount: 2,
        sortOrder: 7,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        checklistTemplate: [{ title: "첫째" }, { title: "둘째" }],
      });
    });

    it("7개 요일이 다 있으면 매일 규칙이다", async () => {
      // Given
      for (const day of [2, 3, 4, 5, 6, 7, 8]) {
        await seedLegacy("group-c", `2026-03-0${day}`);
      }
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-c" } });
      expect(series).toMatchObject({
        repeatFrequency: "DAILY",
        repeatWeekdays: null,
        generatedCount: 7,
        scheduledLocalTime: null,
        timezone: "UTC",
      });
    });

    it("사용자 시간대가 잘못 저장돼 있어도 UTC로 이관한다", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "Mars/Olympus" });
      await seedLegacy("group-d", "2026-03-02", {
        scheduledTime: new Date("2026-03-02T00:30:00.000Z"),
      });
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-d" } });
      expect(series).toMatchObject({ timezone: "UTC", scheduledLocalTime: "00:30" });
    });
  });

  describe("제약", () => {
    function seriesRow(overrides: Partial<typeof todoSeries.$inferInsert> = {}) {
      return {
        id: createEntityId(),
        userId,
        categoryId,
        title: "규칙",
        timezone: "UTC",
        repeatFrequency: "DAILY" as const,
        startDate: new Date("2026-03-02T00:00:00.000Z"),
        sortOrder: 0,
        ...overrides,
      };
    }

    it("같은 묶음의 같은 회차 날짜는 한 행만 들어가고 ON CONFLICT로 건너뛸 수 있다", async () => {
      // Given
      const occurrenceDate = new Date("2026-03-02T00:00:00.000Z");
      await seedLegacy("group-e", "2026-03-02", { occurrenceDate });
      // When
      const inserted = await client
        .insert(todo)
        .values({
          ...omit(TodoFixture.create({ userId, categoryId, sortOrder: 1 }), ["id"]),
          seriesId: "group-e",
          occurrenceDate,
          startDate: occurrenceDate,
        })
        .onConflictDoNothing({
          target: [todo.seriesId, todo.occurrenceDate],
          where: sql`${todo.occurrenceDate} IS NOT NULL`,
        })
        .returning();
      // Then
      expect(inserted).toEqual([]);
      expect(await client.$count(todo, eq(todo.seriesId, "group-e"))).toBe(1);
    });

    it("회차 날짜가 없는 옛 코드의 묶음 행은 유니크 인덱스에 걸리지 않는다", async () => {
      // Given
      await seedLegacy("group-f", "2026-03-02");
      // When
      await seedLegacy("group-f", "2026-03-02");
      // Then
      expect(await client.$count(todo, eq(todo.seriesId, "group-f"))).toBe(2);
    });

    it.each([
      { name: "간격 3", row: { repeatInterval: 3 } },
      { name: "매주인데 요일 없음", row: { repeatFrequency: "WEEKLY" as const } },
      { name: "매일인데 요일 있음", row: { repeatWeekdays: ["MON"] } },
      {
        name: "없는 요일",
        row: { repeatFrequency: "WEEKLY" as const, repeatWeekdays: ["ABC"] },
      },
      { name: "매월인데 날짜 없음", row: { repeatFrequency: "MONTHLY" as const } },
      { name: "횟수 366", row: { repeatCount: 366 } },
      {
        name: "날짜와 횟수 종료를 함께",
        row: { repeatCount: 2, repeatUntil: new Date("2026-03-09T00:00:00.000Z") },
      },
    ])("$name 규칙은 CHECK에서 거부한다", async ({ row }) => {
      // Given
      const values = seriesRow(row);
      // When
      const insert = client.insert(todoSeries).values(values);
      // Then
      await expect(insert).rejects.toThrow();
    });
  });

  describe("리포지토리", () => {
    function repository() {
      return new DrizzleTodoSeriesRepository(createDatabaseTransactionFixture(client).txHost);
    }

    function plan(id: string, rule: RepeatRule) {
      return TodoSeries.planCreation({
        id,
        userId,
        categoryId,
        title: "규칙",
        visibility: "PUBLIC",
        scheduledLocalTime: "09:00",
        timezone: "Asia/Seoul",
        rule,
        startDate: "2026-11-02",
        checklistTemplate: [{ title: "항목" }],
        sortOrder: 3,
        at: new Date("2026-11-01T00:00:00.000Z"),
      });
    }

    it.each([
      { name: "매일·계속", rule: RepeatRule.daily({ type: "NEVER" }) },
      {
        name: "격주·날짜까지",
        rule: RepeatRule.weekly(["MON", "WED"], 2, { type: "UNTIL", date: "2027-01-01" }),
      },
      { name: "매월·횟수", rule: RepeatRule.monthly(31, { type: "COUNT", count: 10 }) },
    ])("$name 규칙을 저장하고 그대로 복원한다", async ({ rule }) => {
      // Given
      const id = createEntityId();
      const series = plan(id, rule);
      // When
      await repository().insert(series);
      const restored = await repository().findByIdAndUserId(id, userId);
      // Then
      expect(restored?.getRule().equals(rule)).toBe(true);
      expect(restored?.getChecklistTemplate()).toEqual([{ title: "항목" }]);
      expect(restored?.getScheduledLocalTime()).toBe("09:00");
      expect(restored?.getNextOccurrenceDate()).toBe(series.getNextOccurrenceDate());
    });

    it("커서를 옮긴 규칙을 저장하면 끝난 규칙은 진행 중 개수에서 빠진다", async () => {
      // Given
      const active = plan(createEntityId(), RepeatRule.daily({ type: "NEVER" }));
      const finished = plan(createEntityId(), RepeatRule.daily({ type: "COUNT", count: 1 }));
      await repository().insert(active);
      await repository().insert(finished);
      // When
      finished.planOccurrences("2026-12-31");
      await repository().update(finished);
      // Then
      expect(await repository().countActiveByUserId(userId)).toBe(1);
    });

    it("다음 회차가 through 이하인 규칙만 id 순 커서로 돌려준다", async () => {
      // Given
      const ids = ["a", "b", "c"].map((prefix) => `${prefix}-${createEntityId()}`);
      for (const id of ids) {
        await repository().insert(plan(id, RepeatRule.daily({ type: "NEVER" })));
      }
      const future = `d-${createEntityId()}`;
      await repository().insert(
        TodoSeries.planCreation({
          id: future,
          userId,
          categoryId,
          title: "먼 규칙",
          visibility: "PUBLIC",
          scheduledLocalTime: null,
          timezone: "UTC",
          rule: RepeatRule.daily({ type: "NEVER" }),
          startDate: "2027-06-01",
          checklistTemplate: [],
          sortOrder: 0,
          at: new Date("2026-11-01T00:00:00.000Z"),
        }),
      );
      // When
      const first = await repository().findDueBatch({
        through: "2026-12-01",
        afterId: null,
        limit: 2,
      });
      const second = await repository().findDueBatch({
        through: "2026-12-01",
        afterId: first.at(-1)?.id ?? null,
        limit: 2,
      });
      // Then
      expect(first.map((due) => due.id)).toEqual(ids.slice(0, 2));
      expect(second.map((due) => due.id)).toEqual(ids.slice(2));
    });

    it("다른 트랜잭션이 잡고 있으면 SKIP LOCKED는 건너뛴다", async () => {
      // Given
      const id = createEntityId();
      await repository().insert(plan(id, RepeatRule.daily({ type: "NEVER" })));
      const { txHost, uow } = createDatabaseTransactionFixture(client);
      const locking = new DrizzleTodoSeriesRepository(txHost);
      const held = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = uow.run(async () => {
        await locking.lockForUpdate(id);
        held.resolve();
        await release.promise;
      });
      await held.promise;
      try {
        // When
        const fixture = createDatabaseTransactionFixture(client);
        const skipped = await fixture.uow.run(() =>
          new DrizzleTodoSeriesRepository(fixture.txHost).lockForUpdate(id, { skipLocked: true }),
        );
        // Then
        expect(skipped).toBeNull();
      } finally {
        release.resolve();
        await holder;
      }
      const row = await client.query.todoSeries.findFirst({
        where: { id },
        columns: { id: true },
      });
      expect(row?.id).toBe(id);
      expect(await client.$count(todoSeries, and(eq(todoSeries.id, id)))).toBe(1);
    });
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { RepeatRule } from "#api/modules/planning/todo-series/domain/repeat-rule.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  todoItem,
  todoSeries,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import {
  DEFAULT_DELIVERY_TIMEZONE,
  parseLocalDateTime,
} from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { DateClock } from "#test/doubles/platform/date-clock";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

function readMigrationStatements(suffix: string): string[] {
  const folder = readdirSync(MIGRATIONS_DIR).find((name) => name.endsWith(suffix));
  if (folder == null) {
    throw new Error(`${suffix} 마이그레이션 폴더 누락`);
  }
  return readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim());
}

function readDataMigrationStatements(): string[] {
  return readMigrationStatements("_todo_series").filter((statement) =>
    /^(-- [^\n]*\n)*(UPDATE "Todo"|INSERT INTO "TodoSeries")/.test(statement),
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
        startDate: Temporal.PlainDate.from(date),
        ...overrides,
      })
      .returning();
    if (row == null) {
      throw new Error("Todo fixture 누락");
    }
    return row;
  }

  /** 후속 마이그레이션이 바꾼 칸을 당시 모양으로 돌린 뒤 이관과 후속 마이그레이션을 차례로 적용한다. */
  async function runDataMigration() {
    await client.transaction(async (tx) => {
      await tx.execute(
        sql.raw(
          `ALTER TABLE "TodoSeries" DROP COLUMN "originSeriesId", ADD COLUMN "sortOrder" integer`,
        ),
      );
      await tx.execute(sql.raw(`DROP INDEX "QuotaCharge_requestHash_createdAt_idx"`));
      for (const statement of [
        ...readDataMigrationStatements(),
        ...readMigrationStatements("_todo_series_origin"),
      ]) {
        await tx.execute(sql.raw(statement));
      }
    });
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
      expect(byId.get(kept.id)?.occurrenceDate).toEqual(Temporal.PlainDate.from("2026-03-02"));
      expect(byId.get(duplicate.id)).toMatchObject({ seriesId: null, occurrenceDate: null });
      expect(byId.get(other.id)?.occurrenceDate).toEqual(Temporal.PlainDate.from("2026-03-04"));
      expect(byId.get(single.id)).toMatchObject({ seriesId: null, occurrenceDate: null });
    });

    it("묶음마다 끝난 규칙을 만들고 내용과 실제 날짜 요일을 옮긴다", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "Asia/Seoul" });
      const first = await seedLegacy("group-b", "2026-03-02", {
        title: "월수 반복",
        visibility: "PUBLIC",
        sortOrder: 7,
        scheduledTime: Temporal.Instant.from("2026-03-02T00:30:00.000Z"),
        isAllDay: false,
        createdAt: Temporal.Instant.from("2026-03-01T00:00:00.000Z"),
      });
      await seedLegacy("group-b", "2026-03-04", {
        title: "월수 반복",
        visibility: "PUBLIC",
        sortOrder: 8,
        scheduledTime: Temporal.Instant.from("2026-03-04T00:30:00.000Z"),
        isAllDay: false,
      });
      await client.insert(todoItem).values([
        { todoId: first.id, title: "둘째", sortOrder: 1, updatedAt: nowInstant() },
        { todoId: first.id, title: "첫째", sortOrder: 0, updatedAt: nowInstant() },
      ]);
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-b" } });
      expect(series).toMatchObject({
        userId,
        categoryId,
        title: "월수 반복",
        visibility: "PUBLIC",
        scheduledLocalTime: "09:30",
        timezone: "Asia/Seoul",
        repeatFrequency: "WEEKLY",
        repeatInterval: 1,
        repeatWeekdays: ["MON", "WED"],
        repeatMonthDay: null,
        repeatCount: null,
        startDate: Temporal.PlainDate.from("2026-03-02"),
        repeatUntil: Temporal.PlainDate.from("2026-03-04"),
        nextOccurrenceDate: null,
        generatedCount: 2,
        originSeriesId: "group-b",
        createdAt: Temporal.Instant.from("2026-03-01T00:00:00.000Z"),
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
      });
    });
  });

  describe("이관 규칙의 시간대", () => {
    it.each([
      { name: "설정 없음", stored: null, zone: DEFAULT_DELIVERY_TIMEZONE, time: "09:30" },
      { name: "잘못된 값", stored: "Mars/Olympus", zone: DEFAULT_DELIVERY_TIMEZONE, time: "09:30" },
      { name: "진짜 UTC", stored: "UTC", zone: "UTC", time: "00:30" },
      { name: "뉴욕", stored: "America/New_York", zone: "America/New_York", time: "09:30" },
      { name: "서울", stored: "Asia/Seoul", zone: "Asia/Seoul", time: "09:30" },
    ])("$name: 규칙 시간대 $zone, 벽시계 $time", async ({ stored, zone, time }) => {
      // Given
      if (stored != null) {
        await client.insert(userPreference).values({ userId, timezone: stored });
      }
      const row = await seedLegacy("group-zone", "2026-03-02", {
        scheduledTime: instantFromDate(parseLocalDateTime("2026-03-02", time, zone)),
        isAllDay: false,
      });
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-zone" } });
      expect(series).toMatchObject({ timezone: zone, scheduledLocalTime: time });
      const migrated = await client.query.todo.findFirst({ where: { id: row.id } });
      expect(migrated?.scheduledTime).toEqual(row.scheduledTime);
      expect(
        instantFromDate(
          parseLocalDateTime(
            "2026-03-02",
            series?.scheduledLocalTime ?? "",
            series?.timezone ?? "",
          ),
        ),
      ).toEqual(row.scheduledTime);
    });

    it("규칙 시간대에서 벽시계가 같으면 DST로 순간이 달라도 한 시각이다", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "America/New_York" });
      for (const date of ["2026-03-02", "2026-03-09", "2026-03-16"]) {
        await seedLegacy("group-dst", date, {
          scheduledTime: instantFromDate(parseLocalDateTime(date, "09:00", "America/New_York")),
          isAllDay: false,
        });
      }
      // When
      await runDataMigration();
      // Then
      const series = await client.query.todoSeries.findFirst({ where: { id: "group-dst" } });
      expect(series).toMatchObject({ scheduledLocalTime: "09:00", timezone: "America/New_York" });
    });
  });

  describe("이관 규칙 유추", () => {
    const CREATED_AT = Temporal.Instant.from("2026-02-01T00:00:00.000Z");
    const UNTOUCHED = { createdAt: CREATED_AT, updatedAt: CREATED_AT.add({ milliseconds: 1 }) };
    const TOUCHED = {
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT.add({ hours: 24 }),
    };

    type LegacyRow = readonly [date: string, overrides?: Partial<typeof todo.$inferInsert>];

    async function migrateGroup(rows: readonly LegacyRow[]) {
      for (const [date, overrides] of rows) {
        await seedLegacy("group", date, { ...UNTOUCHED, ...overrides });
      }
      await runDataMigration();
      return client.query.todoSeries.findFirst({ where: { id: "group" } });
    }

    it("첫 회차만 바꾼 제목·카테고리·시간은 규칙이 되지 않는다 (G9, G13)", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "Asia/Seoul" });
      const [other] = await client
        .insert(todoCategory)
        .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 1 }), ["id"]))
        .returning();
      // When
      const series = await migrateGroup([
        [
          "2026-03-02",
          {
            ...TOUCHED,
            title: "첫 회차만 바꾼 제목",
            categoryId: other?.id ?? 0,
            scheduledTime: Temporal.Instant.from("2026-03-01T22:15:00.000Z"),
            isAllDay: false,
          },
        ],
        ["2026-03-09"],
        ["2026-03-16"],
        ["2026-03-23"],
      ]);
      // Then
      expect(series).toMatchObject({
        title: "옛 반복",
        categoryId,
        scheduledLocalTime: null,
        repeatWeekdays: ["MON"],
      });
    });

    it("제목·카테고리·시간이 동률이면 가장 최근 회차 값이다", async () => {
      // Given
      await client.insert(userPreference).values({ userId, timezone: "Asia/Seoul" });
      const [other] = await client
        .insert(todoCategory)
        .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 1 }), ["id"]))
        .returning();
      // When
      const series = await migrateGroup([
        [
          "2026-03-02",
          {
            title: "앞",
            scheduledTime: Temporal.Instant.from("2026-03-02T00:00:00.000Z"),
            isAllDay: false,
          },
        ],
        [
          "2026-03-09",
          {
            title: "뒤",
            categoryId: other?.id ?? 0,
            scheduledTime: Temporal.Instant.from("2026-03-09T01:00:00.000Z"),
            isAllDay: false,
          },
        ],
      ]);
      // Then
      expect(series).toMatchObject({
        title: "뒤",
        categoryId: other?.id,
        scheduledLocalTime: "10:00",
      });
    });

    it.each([
      { name: "첫 행만 비공개", first: "PRIVATE", rest: "PUBLIC", last: "PUBLIC" },
      { name: "첫 행만 공개", first: "PUBLIC", rest: "PRIVATE", last: "PRIVATE" },
      { name: "한 행만 비공개", first: "PUBLIC", rest: "PUBLIC", last: "PRIVATE" },
    ] as const)("$name: 새 회차는 비공개다", async ({ first, rest, last }) => {
      // When
      const series = await migrateGroup([
        ["2026-03-02", { visibility: first }],
        ["2026-03-09", { visibility: rest }],
        ["2026-03-16", { visibility: last }],
      ]);
      // Then
      expect(series?.visibility).toBe("PRIVATE");
    });

    it("모두 공개면 공개다", async () => {
      // When
      const series = await migrateGroup([
        ["2026-03-02", { visibility: "PUBLIC" }],
        ["2026-03-09", { visibility: "PUBLIC" }],
      ]);
      // Then
      expect(series?.visibility).toBe("PUBLIC");
    });

    it.each([
      {
        name: "월요일 묶음에서 하나를 화요일로 옮김 (G5)",
        rows: [
          ["2026-11-02"],
          ["2026-11-10", TOUCHED],
          ["2026-11-16"],
          ["2026-11-23"],
          ["2026-11-30"],
          ["2026-12-07"],
          ["2026-12-14"],
        ],
        weekdays: ["MON"],
      },
      {
        name: "월~토에서 마지막 토요일을 일요일로 옮김 (G6)",
        rows: [
          ["2026-11-02"],
          ["2026-11-03"],
          ["2026-11-04"],
          ["2026-11-05"],
          ["2026-11-06"],
          ["2026-11-07"],
          ["2026-11-09"],
          ["2026-11-10"],
          ["2026-11-11"],
          ["2026-11-12"],
          ["2026-11-13"],
          ["2026-11-15", TOUCHED],
        ],
        weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
      {
        name: "두 주 월요일에서 둘째를 화요일로 옮김",
        rows: [["2026-11-02"], ["2026-11-10", TOUCHED]],
        weekdays: ["MON"],
      },
      {
        name: "한 주 안에서 끝나는 월·수·금 (기간 때문에 건수가 다름)",
        rows: [["2026-11-04"], ["2026-11-06"], ["2026-11-09"], ["2026-11-11"]],
        weekdays: ["MON", "WED", "FRI"],
      },
      {
        name: "모두 손댔어도 건수가 충분한 요일은 남고 옮긴 하나는 빠짐",
        rows: [
          ["2026-11-02", TOUCHED],
          ["2026-11-09", TOUCHED],
          ["2026-11-17", TOUCHED],
          ["2026-11-23", TOUCHED],
          ["2026-11-30", TOUCHED],
        ],
        weekdays: ["MON"],
      },
      {
        name: "완료로 손댄 수요일도 건수가 충분하면 남음",
        rows: [
          ["2026-11-02"],
          ["2026-11-04", { ...TOUCHED, completed: true }],
          ["2026-11-09"],
          ["2026-11-11", { ...TOUCHED, completed: true }],
        ],
        weekdays: ["MON", "WED"],
      },
    ] satisfies readonly { name: string; rows: readonly LegacyRow[]; weekdays: string[] }[])(
      "$name: 요일 $weekdays",
      async ({ rows, weekdays }) => {
        // When
        const series = await migrateGroup(rows);
        // Then
        expect(series).toMatchObject({ repeatFrequency: "WEEKLY", repeatWeekdays: weekdays });
      },
    );

    it("요일을 정할 수 없는 묶음은 규칙을 만들지 않아 틀린 라벨이 보이지 않는다", async () => {
      // Given
      const rows: readonly LegacyRow[] = [
        ["2026-11-02", TOUCHED],
        ["2026-11-10", TOUCHED],
      ];
      // When
      const series = await migrateGroup(rows);
      // Then
      expect(series).toBeUndefined();
      const migrated = await client.query.todo.findMany({ where: { seriesId: "group" } });
      expect(migrated).toHaveLength(2);
      expect(migrated.every((row) => row.occurrenceDate == null)).toBe(true);
    });
  });

  describe("제약", () => {
    function seriesRow(overrides: Partial<typeof todoSeries.$inferInsert> = {}) {
      const id = createEntityId();
      return {
        id,
        originSeriesId: id,
        userId,
        categoryId,
        title: "규칙",
        timezone: "UTC",
        repeatFrequency: "DAILY" as const,
        startDate: Temporal.PlainDate.from("2026-03-02"),
        updatedAt: nowInstant(),
        ...overrides,
      };
    }

    it("같은 묶음의 같은 회차 날짜는 한 행만 들어가고 ON CONFLICT로 건너뛸 수 있다", async () => {
      // Given
      const occurrenceDate = Temporal.PlainDate.from("2026-03-02");
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
        row: { repeatCount: 2, repeatUntil: Temporal.PlainDate.from("2026-03-09") },
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
      return new DrizzleTodoSeriesRepository(
        createDatabaseTransactionFixture(client).txHost,
        new DateClock(),
      );
    }

    function plan(id: string, rule: RepeatRule) {
      return TodoSeries.create({
        id: TodoSeriesId.reconstitute(id),
        userId: UserId.reconstitute(userId),
        categoryId,
        title: TodoTitle.create("규칙"),
        visibility: "PUBLIC",
        scheduledLocalTime: "09:00",
        timezone: "Asia/Seoul",
        rule,
        startDate: "2026-11-02",
        checklistTemplate: [{ title: "항목" }],
        now: Temporal.Instant.fromEpochMilliseconds(new Date("2026-11-01T00:00:00.000Z").getTime()),
      });
    }

    it.each([
      {
        name: "매일·계속",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      },
      {
        name: "격주·날짜까지",
        rule: RepeatRule.create({
          frequency: "WEEKLY",
          weekdays: ["MON", "WED"],
          interval: 2,
          end: { type: "UNTIL", date: "2027-01-01" },
        }),
      },
      {
        name: "매월·횟수",
        rule: RepeatRule.create({
          frequency: "MONTHLY",
          monthDay: 31,
          end: { type: "COUNT", count: 10 },
        }),
      },
    ])("$name 규칙을 저장하고 그대로 복원한다", async ({ rule }) => {
      // Given
      const id = createEntityId();
      const series = plan(id, rule);
      // When
      await repository().insert(series);
      const restored = await repository().findByIdAndUserId(
        TodoSeriesId.reconstitute(id),
        UserId.reconstitute(userId),
      );
      // Then
      expect(restored?.rule.equals(rule)).toBe(true);
      expect(restored?.checklistTemplate).toEqual([{ title: "항목" }]);
      expect(restored?.scheduledLocalTime).toBe("09:00");
      expect(restored?.nextOccurrenceDate).toBe(series.nextOccurrenceDate);
    });

    it("커서를 옮긴 규칙을 저장하면 끝난 규칙은 진행 중 개수에서 빠진다", async () => {
      // Given
      const active = plan(
        createEntityId(),
        RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      );
      const finished = plan(
        createEntityId(),
        RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 1 } }),
      );
      await repository().insert(active);
      await repository().insert(finished);
      // When
      finished.planOccurrences("2026-12-31");
      await repository().update(finished);
      // Then
      expect(await repository().countActiveByUserId(UserId.reconstitute(userId))).toBe(1);
    });

    it("다음 회차가 through 이하인 규칙만 id 순 커서로 돌려준다", async () => {
      // Given
      const ids = ["a", "b", "c"].map((prefix) => `${prefix}-${createEntityId()}`);
      for (const id of ids) {
        await repository().insert(
          plan(id, RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } })),
        );
      }
      const future = `d-${createEntityId()}`;
      await repository().insert(
        TodoSeries.create({
          id: TodoSeriesId.reconstitute(future),
          userId: UserId.reconstitute(userId),
          categoryId,
          title: TodoTitle.create("먼 규칙"),
          visibility: "PUBLIC",
          scheduledLocalTime: null,
          timezone: "UTC",
          rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
          startDate: "2027-06-01",
          checklistTemplate: [],
          now: Temporal.Instant.fromEpochMilliseconds(
            new Date("2026-11-01T00:00:00.000Z").getTime(),
          ),
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
        afterId: first.map((due) => TodoSeriesId.reconstitute(due.id)).at(-1) ?? null,
        limit: 2,
      });
      // Then
      expect(first.map((due) => due.id)).toEqual(ids.slice(0, 2));
      expect(second.map((due) => due.id)).toEqual(ids.slice(2));
    });

    it("다른 트랜잭션이 잡고 있으면 SKIP LOCKED는 건너뛴다", async () => {
      // Given
      const id = createEntityId();
      await repository().insert(
        plan(id, RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } })),
      );
      const { txHost, uow } = createDatabaseTransactionFixture(client);
      const locking = new DrizzleTodoSeriesRepository(txHost, new DateClock());
      const held = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = uow.run(async () => {
        await locking.lockForUpdate(TodoSeriesId.reconstitute(id));
        held.resolve();
        await release.promise;
      });
      await held.promise;
      try {
        // When
        const fixture = createDatabaseTransactionFixture(client);
        const skipped = await fixture.uow.run(() =>
          new DrizzleTodoSeriesRepository(fixture.txHost, new DateClock()).lockForUpdate(
            TodoSeriesId.reconstitute(id),
            {
              skipLocked: true,
            },
          ),
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

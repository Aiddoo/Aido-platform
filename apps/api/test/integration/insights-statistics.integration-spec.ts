import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import postgres from "@prisma/orm-postgres/runtime";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import type { Contract } from "#api/generated/prisma8/contract.d";
import {
  WEEKLY_ACHIEVEMENT_REPOSITORY,
  type WeeklyAchievementRepositoryPort,
} from "#api/modules/insights/application/ports/weekly-achievements/weekly-achievement.repository.port";
import { GetWeeklyAchievement } from "#api/modules/insights/application/use-cases/weekly-achievements/get-weekly-achievement.use-case";
import { GetWeeklyAchievements } from "#api/modules/insights/application/use-cases/weekly-achievements/get-weekly-achievements.use-case";
import type { WeeklyAchievementUpsert } from "#api/modules/insights/domain/records/weekly-achievements/weekly-achievement.record";
import { PrismaTodoCompletionRepository } from "#api/modules/insights/infrastructure/persistence/daily-completions/prisma-todo-completion.repository";
import { encodeCreate } from "#api/platform/database/database-records";
import { utcTimestampParameters } from "#api/platform/database/database-timestamp.middleware";
import { databaseSqlState } from "#api/platform/database/prisma-error.util";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { UserFixture, TodoFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
const AT = new Date("2027-01-08T12:00:00Z");
let statements: string[] | null = null;
const trace: SqlMiddleware = {
  name: "insights-query-observer",
  familyId: "sql",
  async afterQuery(plan, result) {
    if (statements !== null && result.source === "driver") statements.push(plan.sql);
  },
  async afterExecute(plan, result) {
    if (statements !== null && result.source === "driver") statements.push(plan.sql);
  },
};
describe("Insights 집계·주간 기록 실제 PostgreSQL 회귀", () => {
  let db: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let daily: PrismaTodoCompletionRepository;
  let weekly: WeeklyAchievementRepositoryPort;
  beforeAll(async () => {
    db = new TestDatabase({
      createClient(url) {
        const pool = new Pool({ connectionString: url, max: 4 });
        const native = postgres<Contract>({
          contractJson,
          pg: pool,
          middleware: [utcTimestampParameters, trace],
        });
        let closed = false;
        return {
          ...native,
          async close() {
            if (closed) return;
            closed = true;
            await native.close();
            await pool.end();
          },
        };
      },
    });
    client = await db.start();
    context = await createE2eApp({ testDatabase: db });
    weekly = context.module.get(WEEKLY_ACHIEVEMENT_REPOSITORY);
    daily = new PrismaTodoCompletionRepository(createDatabaseTransactionFixture(client).txHost);
  });
  beforeEach(async () => {
    statements = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
  });
  afterEach(() => {
    statements = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await destroyE2eApp(context);
  });
  async function measure<T>(name: string, work: () => Promise<T>) {
    statements = [];
    try {
      const result = await work();
      const sql = statements.filter(
        (value) => !/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(value),
      );
      process.stdout.write(
        "INSIGHTS_SQL_AFTER " +
          JSON.stringify({
            name,
            count: sql.length,
            statementHeads: sql.map((value) => value.trim().slice(0, 110)),
          }) +
          "\n",
      );
      return { result, count: sql.length };
    } finally {
      statements = null;
    }
  }
  function snapshot(
    week: number,
    overrides: Partial<WeeklyAchievementUpsert> = {},
  ): WeeklyAchievementUpsert {
    return {
      userId,
      year: 2027,
      week,
      totalTodos: 5,
      completedTodos: 3,
      achievedAt: new Date(AT),
      ...overrides,
    };
  }
  it("일일집계는 날짜/카테고리 수와 무관하게 두 SQL, 빈 기간은 한 SQL", async () => {
    // Given
    const categories = [];
    for (let index = 0; index < 3; index++) {
      const row = await client.orm.public.TodoCategory.create(
        encodeCreate(
          "TodoCategory",
          omit(
            TodoCategoryFixture.create({
              userId,
              name: `category ${index}`,
              color: ["#FF0000", "#00FF00", "#0000FF"][index],
              sortOrder: index,
            }),
            ["id"],
          ),
        ),
      );
      categories.push(row);
    }
    for (let index = 0; index < 9; index++) {
      const category = categories[index % 3];
      if (category === undefined) throw new Error("category absent");
      await client.orm.public.Todo.create(
        encodeCreate(
          "Todo",
          omit(
            TodoFixture.create({
              userId,
              categoryId: category.id,
              startDate: new Date(`2027-01-0${1 + Math.floor(index / 3)}T00:00:00Z`),
              completed: index % 2 === 0,
              visibility: index === 0 ? "PRIVATE" : "PUBLIC",
              sortOrder: index,
            }),
            ["id"],
          ),
        ),
      );
    }
    const range = {
      userId,
      startDate: new Date("2027-01-01T00:00:00Z"),
      endDate: new Date("2027-01-04T00:00:00Z"),
    };
    // When
    const all = await measure("daily-nine-todos-three-categories", () =>
      daily.aggregateByDateRange(range),
    );
    const visible = await measure("daily-public-only", () =>
      daily.aggregatePublicByDateRange(range),
    );
    const empty = await measure("daily-empty", () =>
      daily.aggregateByDateRange({
        ...range,
        startDate: new Date("2028-01-01T00:00:00Z"),
        endDate: new Date("2028-01-04T00:00:00Z"),
      }),
    );
    // Then
    expect(all.count).toBe(2);
    expect(all.result).toHaveLength(3);
    expect(all.result.reduce((total, row) => total + row.total, 0)).toBe(9);
    expect(visible.count).toBe(2);
    expect(visible.result.reduce((total, row) => total + row.total, 0)).toBe(8);
    expect(empty.count).toBe(1);
    expect(empty.result).toEqual([]);
  });
  it("주간 기록을 원자 저장하고 동일 키 갱신 시 달성 시각을 보존한다", async () => {
    // Given
    const records = [snapshot(1), snapshot(2), snapshot(3)];
    // When
    const insert = await measure("weekly-upsert-three-new", () => weekly.upsertMany(records));
    const update = await measure("weekly-upsert-three-existing", () =>
      weekly.upsertMany(records.map((row) => ({ ...row, completedTodos: 4 }))),
    );
    // Then
    expect(insert.count).toBe(3);
    expect(update.count).toBe(3);
    expect(await weekly.findByYearAndWeek(userId, 2027, 2)).toMatchObject({
      completedTodos: 4,
      achievedAt: AT,
    });
  });
  it("목록과 summary는 두 SQL, 유효 cursor도 두 SQL", async () => {
    // Given
    await weekly.upsertMany([snapshot(1), snapshot(2), snapshot(3)]);
    const useCase = context.module.get(GetWeeklyAchievements);
    // When
    const first = await measure("weekly-list-no-cursor", () =>
      useCase.execute({ userId, year: 2027, cursor: undefined, size: 2, locale: "ko" }),
    );
    const next = await measure("weekly-list-valid-cursor", () =>
      useCase.execute({ userId, year: 2027, cursor: 2, size: 2, locale: "en" }),
    );
    // Then
    expect(first.count).toBe(2);
    expect(first.result.items.map((row) => row.week)).toEqual([3, 2]);
    expect(first.result.summary.totalWeeks).toBe(3);
    expect(next.count).toBe(2);
    expect(next.result.items.map((row) => row.week)).toEqual([1]);
  });
  it("같은 user/year/week 중복입력은 기존순서대로 마지막 값이 이긴다", async () => {
    // Given
    const records = [snapshot(1, { completedTodos: 1 }), snapshot(1, { completedTodos: 4 })];
    // When
    const result = await measure("weekly-duplicate-input", () => weekly.upsertMany(records));
    // Then
    expect(result.count).toBe(2);
    expect(await weekly.findByYearAndWeek(userId, 2027, 1)).toMatchObject({ completedTodos: 4 });
    expect(
      await client.orm.public.WeeklyAchievement.aggregate((a) => ({ count: a.count() })),
    ).toEqual({ count: 1 });
  });
  it("batch 두번째 FK 실패는 앞서 성공한 첫 행도 rollback한다", async () => {
    // Given
    const records = [snapshot(1), snapshot(2, { userId: "missing-user" })];
    let failure: unknown;
    // When
    try {
      await weekly.upsertMany(records);
    } catch (error) {
      failure = error;
    }
    // Then
    expect(databaseSqlState(failure)).toBe("23503");
    expect(
      await client.orm.public.WeeklyAchievement.aggregate((a) => ({ count: a.count() })),
    ).toEqual({ count: 0 });
  });
  it("같은 owner/year에 존재하는 cursor만 주차 내림차순과 take를 한 SQL로 읽는다", async () => {
    // Given
    await weekly.upsertMany([snapshot(1), snapshot(2), snapshot(3), snapshot(4)]);
    const foreign = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", foreign));
    await weekly.upsertMany([snapshot(7, { userId: foreign.id }), snapshot(8, { year: 2026 })]);
    const cases = [
      { name: "valid-anchor", cursor: 4, expected: [3, 2, 1] },
      { name: "no-anchor-input", cursor: undefined, expected: [4, 3, 2] },
      { name: "missing-anchor", cursor: 99, expected: [] },
      { name: "foreign-user-anchor", cursor: 7, expected: [] },
      { name: "other-year-anchor", cursor: 8, expected: [] },
      { name: "first-week-anchor", cursor: 1, expected: [] },
    ];
    for (const item of cases) {
      // When
      const result = await measure("weekly-cursor-" + item.name, () =>
        weekly.findByYear(userId, 2027, item.cursor, 3),
      );
      // Then
      expect(result.count).toBe(1);
      expect(result.result.map((row) => row.week)).toEqual(item.expected);
      for (const record of result.result) {
        expect(record.year).toBe(2027);
        expect(record.achievedAt).toEqual(AT);
      }
    }
  });
  it("실제 주간 상세는 locale로 직렬화하고 없는 기록은 기존 오류로 거부한다", async () => {
    // Given
    await weekly.upsertMany([snapshot(1)]);
    const get = context.module.get(GetWeeklyAchievement);
    // When
    const ko = await get.execute({ userId, year: 2027, week: 1, locale: "ko" });
    const en = await get.execute({ userId, year: 2027, week: 1, locale: "en" });
    // Then
    expect(ko.achievedAt).toBe(AT.toISOString());
    expect(en.achievedAt).toBe(ko.achievedAt);
    expect(ko.weekLabel).not.toBe(en.weekLabel);
    expect(ko.dateRange).toEqual(en.dateRange);
    await expect(get.execute({ userId, year: 2027, week: 52, locale: "ko" })).rejects.toMatchObject(
      { errorCode: "ACHIEVEMENT_1801" },
    );
  });
});

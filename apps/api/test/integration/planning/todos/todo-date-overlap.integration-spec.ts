import { and, count, eq, gte, isNull, lte, or } from "drizzle-orm";
import { omit, sumBy } from "es-toolkit";

import { DrizzleTodoCompletionStatsReader } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-todo-completion-stats.reader";
import { DrizzleTodoCompletionGroupReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-completion-group.reader";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { TodoCategoryFixture, TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const day = (iso: string) => Temporal.PlainDate.from(iso);

// 하루짜리(null 종료일)·종료일이 시작일과 같은 할 일·여러 날 할 일을 구간 경계 앞뒤로 흩는다
const TODO_SPANS: readonly (readonly [string, string | null])[] = [
  ["2026-11-29", null],
  ["2026-11-30", null],
  ["2026-12-01", null],
  ["2026-12-03", null],
  ["2026-12-05", null],
  ["2026-12-06", null],
  ["2026-12-03", "2026-12-03"],
  ["2026-11-28", "2026-11-30"],
  ["2026-11-28", "2026-12-01"],
  ["2026-11-30", "2026-12-03"],
  ["2026-12-02", "2026-12-04"],
  ["2026-12-05", "2026-12-08"],
  ["2026-12-06", "2026-12-09"],
  ["2026-11-20", "2026-12-20"],
];

const WINDOWS: readonly (readonly [string, string])[] = [
  ["2026-12-01", "2026-12-01"],
  ["2026-12-03", "2026-12-03"],
  ["2026-12-01", "2026-12-05"],
  ["2026-11-25", "2026-11-27"],
  ["2026-12-21", "2026-12-31"],
];

describe("할 일 날짜 겹침 조건 — 두 갈래 조건이 옛 조건과 같은 할 일을 센다 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let userId: string;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    userId = createEntityId();
    await client.insert(user).values(UserFixture.create({ id: userId, userTag: "OVERLAP1" }));
    const category = TodoCategoryFixture.create({ userId });
    await client.insert(todoCategory).values(category);
    await client.insert(todo).values(
      TODO_SPANS.map(([startDate, endDate], index) =>
        omit(
          TodoFixture.create({
            userId,
            categoryId: category.id,
            startDate: day(startDate),
            endDate: endDate == null ? null : day(endDate),
            completed: index % 2 === 0,
            visibility: "PUBLIC",
          }),
          ["id"],
        ),
      ),
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  // 바꾸기 전 조건: startDate <= end AND (endDate >= start OR (endDate IS NULL AND startDate >= start))
  async function countWithLegacyCondition(start: Temporal.PlainDate, end: Temporal.PlainDate) {
    const groups = await client
      .select({ completed: todo.completed, count: count() })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userId),
          lte(todo.startDate, end),
          or(gte(todo.endDate, start), and(isNull(todo.endDate), gte(todo.startDate, start))),
        ),
      )
      .groupBy(todo.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }

  it.each(WINDOWS)("일간 완료 구간 %s~%s의 묶음 합이 옛 조건과 같다", async (start, end) => {
    // Given
    const reader = new DrizzleTodoCompletionGroupReader(
      createDatabaseTransactionFixture(client).txHost,
    );

    // When
    const groups = await reader.listCompletionGroups({
      userId: UserId.reconstitute(userId),
      start: day(start),
      end: day(end),
      publicOnly: false,
    });

    // Then
    expect({
      total: sumBy(groups, (group) => group.todoCount),
      completed: sumBy(
        groups.filter((group) => group.completed),
        (group) => group.todoCount,
      ),
    }).toEqual(await countWithLegacyCondition(day(start), day(end)));
  });

  it.each(["2026-11-27", "2026-11-28", "2026-12-01", "2026-12-03", "2026-12-06", "2026-12-21"])(
    "스트릭 하루 집계 %s가 옛 조건과 같다",
    async (date) => {
      // Given
      const reader = new DrizzleTodoCompletionStatsReader(client);

      // When
      const stats = await reader.countForDay(UserId.reconstitute(userId), day(date));

      // Then
      expect(stats).toEqual(await countWithLegacyCondition(day(date), day(date)));
    },
  );

  it("비교 기준인 옛 조건도 겹치는 할 일을 실제로 센다", async () => {
    // Given
    const window = day("2026-12-03");

    // When
    const legacy = await countWithLegacyCondition(window, window);

    // Then
    expect(legacy.total).toBe(5);
  });
});

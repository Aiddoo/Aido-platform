import { omit } from "es-toolkit";

import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import {
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SERIES_ID = "list-repeat-series";

describe("할 일 목록의 반복 정보 조회 (실제 PostgreSQL)", () => {
  let recording: string[] | null = null;
  const database = new TestDatabase({
    createClient: (url) =>
      createTestClient(url, { max: 4 }, (statement) => {
        recording?.push(statement);
      }),
  });
  let client: TestDatabaseClient;
  let repository: DrizzleTodoReadRepository;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    client = await database.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    repository = new DrizzleTodoReadRepository(txHost);
  }, 60_000);

  beforeEach(async () => {
    await database.cleanup();
    const owner = UserFixture.create({
      id: createEntityId(),
      email: "list-repeat@example.com",
      userTag: "LISTREP1",
    });
    await client.insert(userTable).values(owner);
    userId = owner.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    categoryId = category.id;
    await client.insert(todoSeries).values({
      id: SERIES_ID,
      originSeriesId: SERIES_ID,
      userId,
      categoryId,
      title: "물 마시기",
      timezone: "Asia/Seoul",
      repeatFrequency: "WEEKLY",
      repeatInterval: 1,
      repeatWeekdays: ["MON", "THU"],
      startDate: Temporal.PlainDate.from("2026-11-02"),
      updatedAt: nowInstant(),
    });
  });

  afterAll(async () => {
    await database.stop();
  });

  function occurrenceDateOf(index: number): Temporal.PlainDate {
    return Temporal.PlainDate.from("2026-11-02").add({ days: index });
  }

  async function seedOccurrences(count: number, overrides: Partial<typeof todo.$inferInsert> = {}) {
    const rows = Array.from({ length: count }, (_, index) => ({
      ...omit(TodoFixture.create({ userId, categoryId, sortOrder: index }), ["id"]),
      seriesId: SERIES_ID,
      occurrenceDate: occurrenceDateOf(index),
      startDate: occurrenceDateOf(index),
      endDate: null,
      ...overrides,
    }));
    await client.insert(todo).values(rows);
  }

  async function seedTodos(count: number, overrides: Partial<typeof todo.$inferInsert> = {}) {
    const rows = Array.from({ length: count }, (_, index) => ({
      ...omit(TodoFixture.create({ userId, categoryId, sortOrder: index }), ["id"]),
      startDate: Temporal.PlainDate.from("2026-11-02"),
      endDate: null,
      ...overrides,
    }));
    await client.insert(todo).values(rows);
  }

  async function countStatements<T>(work: () => Promise<T>) {
    const statements: string[] = [];
    recording = statements;
    try {
      const result = await work();
      return { result, count: statements.length };
    } finally {
      recording = null;
    }
  }

  it("한 페이지의 반복 규칙을 페이지 크기와 상관없이 같은 수의 쿼리로 읽는다", async () => {
    // Given
    await seedOccurrences(40);
    // When
    const small = await countStatements(() =>
      repository.findManyByUserId({ userId: UserId.reconstitute(userId), size: 3 }),
    );
    const large = await countStatements(() =>
      repository.findManyByUserId({ userId: UserId.reconstitute(userId), size: 30 }),
    );
    // Then
    expect(small.result).toHaveLength(4);
    expect(large.result).toHaveLength(31);
    expect(small.count).toBe(2);
    expect(large.count).toBe(small.count);
  });

  it("규칙이 있는 회차에는 repeat와 occurrenceDate를, 단일 할 일에는 null을 준다", async () => {
    // Given
    await seedTodos(1, {
      title: "회차",
      seriesId: SERIES_ID,
      occurrenceDate: Temporal.PlainDate.from("2026-11-02"),
      startDate: Temporal.PlainDate.from("2026-11-04"),
    });
    await seedTodos(1, { title: "단일", sortOrder: 1 });
    // When
    const result = await repository.findManyByUserId({
      userId: UserId.reconstitute(userId),
      size: 10,
    });
    // Then
    const byTitle = new Map(result.map((item) => [item.title, item]));
    expect(byTitle.get("회차")).toMatchObject({
      repeat: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "THU"],
        end: { type: "NEVER" },
      },
      occurrenceDate: "2026-11-02",
      startDate: "2026-11-04",
    });
    expect(byTitle.get("단일")).toMatchObject({ repeat: null, occurrenceDate: null });
  });

  it("규칙 행이 없는 옛 묶음은 repeat가 null이다", async () => {
    // Given
    await seedTodos(1, { seriesId: "orphan-group" });
    // When
    const result = await repository.findManyByUserId({
      userId: UserId.reconstitute(userId),
      size: 10,
    });
    // Then
    expect(result[0]).toMatchObject({ seriesId: "orphan-group", repeat: null });
  });

  it("친구에게 주는 목록에는 repeat와 occurrenceDate 키가 없다", async () => {
    // Given
    await seedOccurrences(2, { visibility: "PUBLIC" });
    // When
    const { result, count } = await countStatements(() =>
      repository.findPublicTodosByUserId({ friendUserId: UserId.reconstitute(userId), size: 10 }),
    );
    // Then
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item).not.toHaveProperty("repeat");
      expect(item).not.toHaveProperty("occurrenceDate");
    }
    expect(count).toBe(2);
  });
});

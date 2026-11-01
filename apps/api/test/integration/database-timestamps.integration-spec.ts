import { eq, inArray } from "drizzle-orm";
import { omit } from "es-toolkit";

import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2027-01-04T12:00:00.123Z");
const TIMEZONES = ["UTC", "Asia/Seoul", "America/Los_Angeles"];

describe("자동 갱신 시각의 UTC 저장 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let userId: string;
  let categoryId: number;
  let todoId: number;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const createdUser = UserFixture.create();
    await client.insert(user).values(createdUser);
    userId = createdUser.id;
    const [category] = await client
      .insert(todoCategory)
      .values(TodoCategoryFixture.create({ userId }))
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    categoryId = category.id;
    const [created] = await client
      .insert(todo)
      .values(omit(TodoFixture.create({ userId, categoryId }), ["id"]))
      .returning();
    if (created === undefined) {
      throw new Error("todo fixture was not created");
    }
    todoId = created.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.stop();
  });

  async function savedUpdatedAt() {
    const row = await client.query.todo.findFirst({
      columns: { updatedAt: true },
      where: { id: todoId },
    });
    return row?.updatedAt;
  }

  it.each(TIMEZONES)(
    "%s 프로세스의 단건 수정은 자동 updatedAt의 UTC 시각을 유지한다",
    async (timezone) => {
      // Given
      vi.stubEnv("TZ", timezone);

      // When
      await client.update(todo).set({ title: "단건 수정" }).where(eq(todo.id, todoId));

      // Then
      expect(await savedUpdatedAt()).toEqual(AT);
    },
  );

  it.each(TIMEZONES)(
    "%s 트랜잭션의 updateAndCount도 자동 UTC 시각을 유지한다",
    async (timezone) => {
      // Given
      vi.stubEnv("TZ", timezone);

      // When
      const affected = await client.transaction(async (transaction) => {
        const rows = await transaction
          .update(todo)
          .set({ title: "트랜잭션 수정" })
          .where(eq(todo.id, todoId))
          .returning({ id: todo.id });
        return rows.length;
      });

      // Then
      expect(affected).toBe(1);
      expect(await savedUpdatedAt()).toEqual(AT);
    },
  );

  it("일괄 생성과 수정의 모든 행에 동일한 자동 UTC 시각을 저장한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const items = [1, 2].map((sortOrder) =>
      omit(TodoFixture.create({ userId, categoryId, sortOrder }), ["id", "updatedAt"]),
    );

    // When
    const created = await client
      .insert(todo)
      .values(items)
      .returning({ id: todo.id, updatedAt: todo.updatedAt });
    const nextAt = new Date("2027-01-04T12:30:00.456Z");
    vi.setSystemTime(nextAt);
    const updated = await client
      .update(todo)
      .set({ title: "일괄 수정" })
      .where(
        inArray(
          todo.id,
          created.map((item) => item.id),
        ),
      )
      .returning({ updatedAt: todo.updatedAt });

    // Then
    expect(created.map((item) => item.updatedAt)).toEqual([AT, AT]);
    expect(updated.map((item) => item.updatedAt)).toEqual([nextAt, nextAt]);
  });

  it("명시적 timestamp와 DATE·timestamptz·null은 기존 저장 계약을 유지한다", async () => {
    // Given
    vi.stubEnv("TZ", "America/Los_Angeles");
    const explicitUpdatedAt = new Date("2026-12-31T23:59:59.789Z");
    const startDate = new Date("2027-01-05T00:00:00.000Z");
    const scheduledTime = new Date("2027-01-05T09:30:00.456+09:00");

    // When
    await client
      .update(todo)
      .set({ updatedAt: explicitUpdatedAt, startDate, scheduledTime, completedAt: null })
      .where(eq(todo.id, todoId));
    const row = await client.query.todo.findFirst({
      columns: { updatedAt: true, startDate: true, scheduledTime: true, completedAt: true },
      where: { id: todoId },
    });

    // Then
    expect(row).toEqual({
      updatedAt: explicitUpdatedAt,
      startDate,
      scheduledTime,
      completedAt: null,
    });
  });

  it("별도 연결을 소유하는 공용 테스트 클라이언트도 자동 UTC 시각을 유지한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const independentClient = createTestClient(database.getConnectionUri(), { max: 1 });

    // When
    try {
      await independentClient
        .update(todo)
        .set({ title: "별도 연결 수정" })
        .where(eq(todo.id, todoId));

      // Then
      expect(await savedUpdatedAt()).toEqual(AT);
    } finally {
      await independentClient.close();
    }
  });
});

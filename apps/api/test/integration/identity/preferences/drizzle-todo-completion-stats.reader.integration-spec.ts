import { DrizzleTodoCompletionStatsReader } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-todo-completion-stats.reader";
import { todo, todoCategory } from "#api/platform/database/schema/index";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { UserFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

const day = (iso: string) => Temporal.PlainDate.from(iso);

describe("DrizzleTodoCompletionStatsReader — 스트릭용 하루 완료 집계 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleTodoCompletionStatsReader;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
    reader = new DrizzleTodoCompletionStatsReader(client);
  });

  afterAll(async () => {
    await testDatabase.stop();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
    const user = await createUserDatabaseFixture(
      client,
      UserFixture.create({ email: "streak@example.com", status: "ACTIVE" }),
      {},
    );
    const [category] = await client
      .insert(todoCategory)
      .values({
        userId: user.id,
        name: "할 일",
        color: "#FF6B43",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        sortOrder: 0,
      })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    userId = user.id;
    categoryId = category.id;
  });

  async function givenTodo(startDate: string, endDate: string | null, completed: boolean) {
    await client.insert(todo).values({
      userId,
      categoryId,
      title: "스트릭 집계 fixture",
      startDate: day(startDate),
      endDate: endDate == null ? null : day(endDate),
      completed,
      updatedAt: nowInstant(),
    });
  }

  it("여러 날 할 일은 시작 전에는 세지 않고 시작일·기간 안·종료일에는 모두 센다", async () => {
    // Given
    await givenTodo("2026-11-28", "2026-12-02", true);
    await givenTodo("2026-11-30", null, false);

    // When
    const counts = await Promise.all(
      ["2026-11-27", "2026-11-28", "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03"].map(
        (date) => reader.countForDay(userId, Temporal.PlainDate.from(date)),
      ),
    );

    // Then
    expect(counts).toEqual([
      { total: 0, completed: 0 },
      { total: 1, completed: 1 },
      { total: 2, completed: 1 },
      { total: 1, completed: 1 },
      { total: 1, completed: 1 },
      { total: 0, completed: 0 },
    ]);
  });

  it("월 경계에 걸친 할 일은 서울 사용자의 12월 1일과 LA 사용자의 11월 30일 모두에 센다", async () => {
    // Given
    await givenTodo("2026-11-30", "2026-12-01", true);
    const now = Temporal.Instant.from("2026-11-30T16:30:00.000Z");

    // When
    const seoulToday = now.toZonedDateTimeISO("Asia/Seoul").toPlainDate();
    const laToday = now.toZonedDateTimeISO("America/Los_Angeles").toPlainDate();
    const seoul = await reader.countForDay(userId, seoulToday);
    const la = await reader.countForDay(userId, laToday);

    // Then
    expect([seoulToday.toString(), laToday.toString()]).toEqual(["2026-12-01", "2026-11-30"]);
    expect(seoul).toEqual({ total: 1, completed: 1 });
    expect(la).toEqual({ total: 1, completed: 1 });
  });

  it("하루짜리 할 일은 그날만 세고 다른 사용자의 할 일은 세지 않는다", async () => {
    // Given
    await givenTodo("2026-12-01", null, true);
    const other = await createUserDatabaseFixture(
      client,
      UserFixture.create({ email: "other@example.com", status: "ACTIVE", userTag: "OTHER234" }),
      {},
    );
    await client.insert(todo).values({
      userId: other.id,
      categoryId,
      title: "다른 사용자",
      startDate: day("2026-12-01"),
      completed: true,
      updatedAt: nowInstant(),
    });

    // When
    const onDay = await reader.countForDay(userId, Temporal.PlainDate.from("2026-12-01"));
    const nextDay = await reader.countForDay(userId, Temporal.PlainDate.from("2026-12-02"));

    // Then
    expect(onDay).toEqual({ total: 1, completed: 1 });
    expect(nextDay).toEqual({ total: 0, completed: 0 });
  });
});

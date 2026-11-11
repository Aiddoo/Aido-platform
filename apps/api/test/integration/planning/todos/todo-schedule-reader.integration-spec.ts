import { DrizzleTodoScheduleReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-schedule.reader";
import { createEntityId } from "#api/platform/database/entity-id";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { TodoCategoryFixture, TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const HOUR_MS = 60 * 60_000;
const SEOUL = "Asia/Seoul";
const TODAY = Temporal.PlainDate.from("2026-11-02");
/** 서울 2026-11-02 07:00 */
const FROM = Temporal.Instant.from("2026-11-01T22:00:00.000Z");
/** 서울 2026-11-03 00:00 */
const UNTIL = Temporal.Instant.from("2026-11-02T15:00:00.000Z");

function dateColumn(date: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(date);
}

describe("날씨 브리핑·알림 할 일 조회 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
  let client: TestDatabaseClient;
  let reader: DrizzleTodoScheduleReader;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    client = await database.start();
    reader = new DrizzleTodoScheduleReader(createDatabaseTransactionFixture(client).txHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    userId = createEntityId();
    otherUserId = createEntityId();
    await client.insert(user).values([
      UserFixture.create({ id: userId, email: "weather-todo@example.com", userTag: "WTODO1" }),
      UserFixture.create({
        id: otherUserId,
        email: "weather-other@example.com",
        userTag: "WTODO2",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function givenTodos(rows: Parameters<typeof TodoFixture.create>[0][]) {
    const categories = [
      TodoCategoryFixture.create({ userId }),
      TodoCategoryFixture.create({ userId: otherUserId }),
    ];
    await client.insert(todoCategory).values(categories);
    const categoryOf = (owner: string | undefined) =>
      (owner === otherUserId ? categories[1] : categories[0])?.id;
    await client.insert(todo).values(
      rows.map((row) =>
        TodoFixture.create({
          startDate: dateColumn("2026-11-02"),
          isAllDay: false,
          ...row,
          userId: row?.userId ?? userId,
          categoryId: categoryOf(row?.userId),
        }),
      ),
    );
  }

  function listToday(userIds: readonly string[], timezone = SEOUL) {
    return reader.listPendingTimedTodos({
      userIds: userIds.map((userId) => UserId.reconstitute(userId)),
      date: TODAY,
      timezone,
      from: FROM,
      until: UNTIL,
    });
  }

  it("요청 사용자의 시각 지정·미완료 할 일 중 [from, until) 안의 것만 시각 순으로 돌려준다", async () => {
    // Given
    await givenTodos([
      { title: "오후 산책", scheduledTime: FROM.add({ milliseconds: 8 * HOUR_MS }) },
      { title: "정각 시작", scheduledTime: FROM },
      { title: "지난 일", scheduledTime: FROM.subtract({ milliseconds: 1 }) },
      { title: "자정 이후", scheduledTime: UNTIL },
      { title: "종일", isAllDay: true, scheduledTime: FROM.add({ milliseconds: HOUR_MS }) },
      { title: "완료", completed: true, scheduledTime: FROM.add({ milliseconds: HOUR_MS }) },
      { title: "시간 없음", scheduledTime: null },
      {
        title: "다른 사람",
        userId: otherUserId,
        scheduledTime: FROM.add({ milliseconds: HOUR_MS }),
      },
    ]);

    // When
    const todos = await listToday([userId]);

    // Then
    expect(todos.map((row) => row.title)).toEqual(["정각 시작", "오후 산책"]);
    expect(todos[1]).toMatchObject({
      userId,
      scheduledAt: FROM.add({ milliseconds: 8 * HOUR_MS }),
    });
  });

  it("사용자 목록이 비면 조회하지 않고 빈 결과다", async () => {
    // When
    const todos = await listToday([]);

    // Then
    expect(todos).toEqual([]);
  });

  it("어제 시작한 이틀짜리 할 일은 오늘의 같은 벽시계 시각으로 시각 순에 끼운다", async () => {
    // Given
    // 어제(11-01) 서울 16:30에 시작해 오늘까지 이어지고, 오늘 13:00 할 일이 따로 있다
    await givenTodos([
      {
        title: "이틀 캠핑",
        startDate: dateColumn("2026-11-01"),
        endDate: dateColumn("2026-11-02"),
        scheduledLocalTime: "16:30",
        scheduledTime: Temporal.Instant.from("2026-11-01T07:30:00.000Z"),
      },
      { title: "점심", scheduledTime: Temporal.Instant.from("2026-11-02T04:00:00.000Z") },
    ]);

    // When
    const todos = await listToday([userId]);

    // Then
    expect(todos.map(({ title, scheduledAt }) => [title, scheduledAt.toString()])).toEqual([
      ["점심", "2026-11-02T04:00:00Z"],
      ["이틀 캠핑", "2026-11-02T07:30:00Z"],
    ]);
  });

  it("여러 날 할 일은 오늘까지 이어지고 오늘 시각이 남았을 때만 오늘 할 일이다", async () => {
    // Given
    await givenTodos([
      {
        title: "어제 끝남",
        startDate: dateColumn("2026-10-31"),
        endDate: dateColumn("2026-11-01"),
        scheduledLocalTime: "16:30",
        scheduledTime: Temporal.Instant.from("2026-10-31T07:30:00.000Z"),
      },
      {
        title: "오늘 시각 지남",
        startDate: dateColumn("2026-11-01"),
        endDate: dateColumn("2026-11-03"),
        scheduledLocalTime: "06:00",
        scheduledTime: Temporal.Instant.from("2026-10-31T21:00:00.000Z"),
      },
      {
        title: "내일 시작",
        startDate: dateColumn("2026-11-03"),
        endDate: dateColumn("2026-11-04"),
        scheduledLocalTime: "09:00",
        scheduledTime: Temporal.Instant.from("2026-11-03T00:00:00.000Z"),
      },
      {
        title: "종일 여러 날",
        startDate: dateColumn("2026-11-01"),
        endDate: dateColumn("2026-11-03"),
        isAllDay: true,
        scheduledTime: null,
      },
    ]);

    // When
    const todos = await listToday([userId]);

    // Then
    expect(todos).toEqual([]);
  });

  it("벽시계 칸이 빈 옛 여러 날 할 일은 시작 시각의 벽시계를 기기 시간대로 읽는다", async () => {
    // Given
    // 11월 로스앤젤레스는 UTC-8이다. 어제(11-01) 21:00 시작이라 오늘(11-02) 21:00 = 11-03 05:00Z
    await givenTodos([
      {
        title: "옛 행",
        startDate: dateColumn("2026-11-01"),
        endDate: dateColumn("2026-11-02"),
        scheduledLocalTime: null,
        scheduledTime: Temporal.Instant.from("2026-11-02T05:00:00.000Z"),
      },
    ]);

    // When
    const todos = await reader.listPendingTimedTodos({
      userIds: [UserId.reconstitute(userId)],
      date: TODAY,
      timezone: "America/Los_Angeles",
      from: instantFromDate(new Date("2026-11-02T15:00:00.000Z")),
      until: instantFromDate(new Date("2026-11-03T08:00:00.000Z")),
    });

    // Then
    expect(todos.map(({ scheduledAt }) => scheduledAt.toString())).toEqual([
      "2026-11-03T05:00:00Z",
    ]);
  });
});

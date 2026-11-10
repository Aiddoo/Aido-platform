import { ConfigService } from "@nestjs/config";

import { DrizzleSchedulerReader } from "#api/modules/notification/infrastructure/persistence/reminders/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import type { EnvConfig } from "#api/platform/config/schemas/index";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { createEntityId } from "#api/platform/database/entity-id";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { TodoCategoryFixture, TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const HOUR_MS = 60 * 60_000;
/** 서울 2026-11-02 07:00 */
const FROM = new Date("2026-11-01T22:00:00.000Z");
/** 서울 2026-11-03 00:00 */
const UNTIL = new Date("2026-11-02T15:00:00.000Z");

describe("날씨 알림 할 일 조회 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
  let client: TestDatabaseClient;
  let memory: InMemoryCacheStore;
  let reader: DrizzleSchedulerReader;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    client = await database.start();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 });
    reader = new DrizzleSchedulerReader(
      createDatabaseTransactionFixture(client).txHost,
      new CacheService(memory),
      new TypedConfigService(new ConfigService<EnvConfig, true>({})),
    );
  });

  beforeEach(async () => {
    suppressLogger();
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
          startDate: new Date("2026-11-02T00:00:00.000Z"),
          isAllDay: false,
          ...row,
          userId: row?.userId ?? userId,
          categoryId: categoryOf(row?.userId),
        }),
      ),
    );
  }

  it("요청 사용자의 시각 지정·미완료 할 일 중 [from, until) 안의 것만 시각 순으로 돌려준다", async () => {
    // Given
    await givenTodos([
      { title: "오후 산책", scheduledTime: new Date(FROM.getTime() + 8 * HOUR_MS) },
      { title: "정각 시작", scheduledTime: FROM },
      { title: "지난 일", scheduledTime: new Date(FROM.getTime() - 1) },
      { title: "자정 이후", scheduledTime: UNTIL },
      { title: "종일", isAllDay: true, scheduledTime: new Date(FROM.getTime() + HOUR_MS) },
      { title: "완료", completed: true, scheduledTime: new Date(FROM.getTime() + HOUR_MS) },
      { title: "시간 없음", scheduledTime: null },
      {
        title: "다른 사람",
        userId: otherUserId,
        scheduledTime: new Date(FROM.getTime() + HOUR_MS),
      },
    ]);

    // When
    const todos = await reader.findScheduledTodosBetween({
      userIds: [userId],
      from: FROM,
      until: UNTIL,
    });

    // Then
    expect(todos.map((row) => row.title)).toEqual(["정각 시작", "오후 산책"]);
    expect(todos[1]).toMatchObject({
      userId,
      scheduledTime: new Date(FROM.getTime() + 8 * HOUR_MS),
    });
  });

  it("사용자 목록이 비면 조회하지 않고 빈 결과다", async () => {
    // When
    const todos = await reader.findScheduledTodosBetween({ userIds: [], from: FROM, until: UNTIL });

    // Then
    expect(todos).toEqual([]);
  });
});

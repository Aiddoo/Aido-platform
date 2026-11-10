import { omit } from "es-toolkit";

import { DrizzleTodoEngagementCounterAdapter } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-engagement-counter.adapter";
import type {
  TodoEngagementCounterPort,
  TodoViewRecord,
} from "#api/modules/planning/todos/planning-todos.public";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const OWNER_ID = "counter-owner";
const VIEWER_ID = "counter-viewer";
const MISSING_TODO_ID = 999_999;

describe("DrizzleTodoEngagementCounterAdapter (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  // engagement가 쓸 public 포트 모양 그대로 검증한다
  let counter: TodoEngagementCounterPort;
  let todoId: number;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    counter = new DrizzleTodoEngagementCounterAdapter(
      createDatabaseTransactionFixture(client).txHost,
      new DateClock(),
    );
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: OWNER_ID, email: "owner@example.com", userTag: "COUNT001" }),
        UserFixture.create({ id: VIEWER_ID, email: "viewer@example.com", userTag: "COUNT002" }),
      ]);
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: OWNER_ID, sortOrder: 0 }), ["id"]))
      .returning();
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId: OWNER_ID, categoryId: category?.id ?? 0 }), ["id"]),
        commentCount: 0,
        viewCount: 0,
      })
      .returning();
    todoId = row?.id ?? 0;
  });

  afterAll(async () => {
    await database.stop();
  });

  async function counts() {
    const row = await client.query.todo.findFirst({
      columns: { commentCount: true, viewCount: true },
      where: { id: todoId },
    });
    return row;
  }

  it("댓글 수를 늘리고 0 아래로는 줄이지 않는다", async () => {
    // Given
    await counter.increaseCommentCount(todoId, 2);

    // When
    const decremented = [
      await counter.decrementCommentCount(todoId),
      await counter.decrementCommentCount(todoId),
      await counter.decrementCommentCount(todoId),
    ];

    // Then
    expect(decremented).toEqual([true, true, false]);
    expect(await counts()).toEqual({ commentCount: 0, viewCount: 0 });
  });

  it("같은 사람이 여러 번 봐도 조회 수는 한 번만 늘린다", async () => {
    // When
    const first = await counter.recordView(todoId, VIEWER_ID);
    const second = await counter.recordView(todoId, VIEWER_ID);

    // Then
    const expected: TodoViewRecord[] = [
      { recorded: true, viewCount: 1 },
      { recorded: false, viewCount: 1 },
    ];
    expect([first, second]).toEqual(expected);
  });

  it("계정 정리용으로 할 일 행을 잠그고 다시 센 댓글 수로 바꾼다", async () => {
    // Given
    await counter.increaseCommentCount(todoId, 3);

    // When
    await counter.lockCounters([todoId]);
    await counter.replaceCommentCounts([{ todoId, commentCount: 1 }]);
    await counter.replaceCommentCounts([]);

    // Then
    expect(await counts()).toEqual({ commentCount: 1, viewCount: 0 });
  });

  it("없는 할 일의 댓글 수를 늘리면 부재 오류를 낸다", async () => {
    // When
    const increasing = counter.increaseCommentCount(MISSING_TODO_ID, 1);

    // Then
    await expect(increasing).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });
});

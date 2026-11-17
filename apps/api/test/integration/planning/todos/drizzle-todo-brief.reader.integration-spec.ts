import { omit } from "es-toolkit";

import { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import { DrizzleTodoBriefReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-brief.reader";
import { requireRecord } from "#api/platform/database/database-error.util";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";
import { TodoCategoryFixture, TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const OWNER_ID = UserId.reconstitute(TODO_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID);
const DATE = Temporal.PlainDate.from("2026-11-17");

describe("DrizzleTodoBriefReader (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleTodoBriefReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    reader = new DrizzleTodoBriefReader(createDatabaseTransactionFixture(client).transactionHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: TODO_FIXTURE_USER_ID, userTag: "TBRIEF01" }),
        UserFixture.create({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "TBRIEF02" }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function givenTodos(
    rows: readonly {
      readonly userId?: string;
      readonly startDate: string;
      readonly endDate?: string;
    }[],
  ): Promise<TodoId[]> {
    const categories = await client
      .insert(todoCategory)
      .values(
        [TODO_FIXTURE_USER_ID, TODO_FIXTURE_OTHER_USER_ID].map((userId) =>
          omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]),
        ),
      )
      .returning({ id: todoCategory.id, userId: todoCategory.userId });
    const inserted = await client
      .insert(todo)
      .values(
        rows.map((row, index) => {
          const userId = row.userId ?? TODO_FIXTURE_USER_ID;
          return omit(
            TodoFixture.create({
              userId,
              categoryId: categories.find((category) => category.userId === userId)?.id ?? 0,
              sortOrder: index,
              startDate: Temporal.PlainDate.from(row.startDate),
              endDate: row.endDate == null ? null : Temporal.PlainDate.from(row.endDate),
            }),
            ["id"],
          );
        }),
      )
      .returning({ id: todo.id });
    return inserted.map((row) => TodoId.reconstitute(row.id));
  }

  it("주인이 아닌 사람 id로 할 일을 잠가 읽으면 null이다", async () => {
    // Given
    const todoId = requireRecord((await givenTodos([{ startDate: "2026-11-17" }]))[0]);

    // When
    const ownedTodo = await reader.lockOwnedTodo(todoId, OWNER_ID);
    const othersTodo = await reader.lockOwnedTodo(todoId, OTHER_USER_ID);

    // Then
    expect(ownedTodo?.todoId).toEqual(todoId);
    expect(ownedTodo?.ownerId).toEqual(OWNER_ID);
    expect(othersTodo).toBeNull();
  });

  it("그 날 할 일 수는 하루 할 일의 시작일과 기간 할 일의 시작~종료일로 세고 남의 할 일은 뺀다", async () => {
    // Given
    await givenTodos([
      { startDate: "2026-11-17" },
      { startDate: "2026-11-16" },
      { startDate: "2026-11-15", endDate: "2026-11-18" },
      { startDate: "2026-11-14", endDate: "2026-11-17" },
      { startDate: "2026-11-18", endDate: "2026-11-20" },
      { startDate: "2026-11-17", userId: TODO_FIXTURE_OTHER_USER_ID },
    ]);

    // When
    const count = await reader.countTodosOn(OWNER_ID, DATE);

    // Then
    expect(count).toBe(3);
  });
});

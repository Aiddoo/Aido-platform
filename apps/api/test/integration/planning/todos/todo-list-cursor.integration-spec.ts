import { omit } from "es-toolkit";

import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import { todo, todoCategory, user as userTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("할 일 목록 커서 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let repository: DrizzleTodoReadRepository;

  beforeAll(async () => {
    client = await database.start();
    const { transactionHost } = createDatabaseTransactionFixture(client);
    repository = new DrizzleTodoReadRepository(transactionHost);
  }, 60_000);

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  async function givenOwnerWithPublicTodos(userTag: string, count: number) {
    const owner = UserFixture.create({
      id: createEntityId(),
      email: `${userTag.toLowerCase()}@example.com`,
      userTag,
    });
    await client.insert(userTable).values(owner);
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: owner.id, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    const todos = await client
      .insert(todo)
      .values(
        Array.from({ length: count }, (_, index) => ({
          ...omit(
            TodoFixture.create({ userId: owner.id, categoryId: category.id, sortOrder: index }),
            ["id"],
          ),
          visibility: "PUBLIC" as const,
        })),
      )
      .returning({ id: todo.id });
    return { userId: UserId.reconstitute(owner.id), todoIds: todos.map(({ id }) => id) };
  }

  it("자기 할 일 id 커서는 그 다음부터 이어 읽는다", async () => {
    // Given
    const owner = await givenOwnerWithPublicTodos("CURSORA1", 3);

    // When
    const page = await repository.findManyByUserId({
      userId: owner.userId,
      cursor: owner.todoIds[0],
      size: 10,
    });

    // Then
    expect(page.map(({ id }) => id)).toEqual(owner.todoIds.slice(1));
  });

  it("다른 사용자의 할 일 id를 커서로 주면 없는 커서처럼 빈 목록이다", async () => {
    // Given
    const owner = await givenOwnerWithPublicTodos("CURSORA1", 3);
    const stranger = await givenOwnerWithPublicTodos("CURSORB1", 1);

    // When
    const own = await repository.findManyByUserId({
      userId: owner.userId,
      cursor: stranger.todoIds[0],
      size: 10,
    });
    const friend = await repository.findPublicTodosByUserId({
      friendUserId: owner.userId,
      cursor: stranger.todoIds[0],
      size: 10,
    });
    const unknown = await repository.findManyByUserId({
      userId: owner.userId,
      cursor: 2_147_483_647,
      size: 10,
    });

    // Then
    expect(own).toEqual([]);
    expect(friend).toEqual([]);
    expect(unknown).toEqual([]);
  });
});

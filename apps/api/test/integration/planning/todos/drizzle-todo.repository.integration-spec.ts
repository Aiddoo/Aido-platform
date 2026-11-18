import { eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import { DrizzleTodoOccurrenceWriterAdapter } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-occurrence-writer.adapter";
import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database.errors";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { describeTodoReadRepositoryContract } from "#test/contracts/planning/todo-read-repository.contract";
import {
  describeTodoRepositoryContract,
  type TodoEngagementCounts,
} from "#test/contracts/planning/todo-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createTodoCategoryRowFixture } from "#test/fixtures/planning/todo-row.fixture";
import {
  createTodoFixture,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleTodoRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let categoryId: number;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        createUserRowFixture({ id: TODO_FIXTURE_USER_ID, userTag: "PLANTD01" }),
        createUserRowFixture({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "PLANTD02" }),
      ]);
    const [category] = await client
      .insert(todoCategory)
      .values(omit(createTodoCategoryRowFixture({ userId: TODO_FIXTURE_USER_ID }), ["id"]))
      .returning({ id: todoCategory.id });
    if (category == null) {
      throw new Error("카테고리 픽스처를 만들지 못했다");
    }
    categoryId = category.id;
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepositories() {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return {
      todoRepository: new DrizzleTodoRepository(transactionHost, new DateClock()),
      occurrenceWriter: new DrizzleTodoOccurrenceWriterAdapter(transactionHost, new DateClock()),
      seriesRepository: new DrizzleTodoSeriesRepository(transactionHost, new DateClock()),
      todoReadRepository: new DrizzleTodoReadRepository(transactionHost),
    };
  }

  const engagementCounts = {
    async write(todoId: TodoId, counts: TodoEngagementCounts): Promise<void> {
      await client.update(todo).set(counts).where(eq(todo.id, todoId.value));
    },
    async read(todoId: TodoId): Promise<TodoEngagementCounts> {
      const [row] = await client
        .select({ commentCount: todo.commentCount, viewCount: todo.viewCount })
        .from(todo)
        .where(eq(todo.id, todoId.value));
      return row ?? { commentCount: -1, viewCount: -1 };
    },
  };

  describeTodoRepositoryContract(async () => ({
    ...createRepositories(),
    categoryId,
    engagementCounts,
  }));

  describeTodoReadRepositoryContract(async () => ({ ...createRepositories(), categoryId }));

  it("없는 할 일을 저장하거나 지우면 부재 오류를 낸다", async () => {
    // Given
    const { todoRepository } = createRepositories();
    const missing = createTodoFixture({
      id: (await todoRepository.nextId()).value,
      categoryId,
    });

    // When
    // 거절을 모두 받아 두어 먼저 끝난 거절이 처리되지 않은 거절로 남지 않게 한다
    const results = await Promise.allSettled([
      todoRepository.delete(missing),
      todoRepository.save(missing),
    ]);

    // Then
    for (const result of results) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: expect.any(DatabaseRecordNotFoundError),
      });
    }
  });
});

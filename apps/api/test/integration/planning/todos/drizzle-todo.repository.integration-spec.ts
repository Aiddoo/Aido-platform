import { omit } from "es-toolkit";

import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { todoCategory, user } from "#api/platform/database/schema/index";
import { describeTodoRepositoryContract } from "#test/contracts/planning/todo-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import {
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
        UserFixture.create({ id: TODO_FIXTURE_USER_ID, userTag: "PLANTD01" }),
        UserFixture.create({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "PLANTD02" }),
      ]);
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: TODO_FIXTURE_USER_ID }), ["id"]))
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
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      todoRepository: new DrizzleTodoRepository(txHost, new DateClock()),
      seriesRepository: new DrizzleTodoSeriesRepository(txHost, new DateClock()),
    };
  }

  describeTodoRepositoryContract(async () => ({ ...createRepositories(), categoryId }));

  it("없는 할 일이나 하위 항목을 고치거나 지우면 부재 오류를 낸다", async () => {
    // Given
    const { todoRepository } = createRepositories();
    const missingId = (await todoRepository.nextId()).value;

    // When - 거절을 모두 받아 두어 먼저 끝난 거절이 처리되지 않은 거절로 남지 않게 한다
    const results = await Promise.allSettled([
      todoRepository.delete(missingId),
      todoRepository.updateTitle(missingId, "제목"),
      todoRepository.updateItem(missingId, { completed: true }),
      todoRepository.deleteItem(missingId),
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

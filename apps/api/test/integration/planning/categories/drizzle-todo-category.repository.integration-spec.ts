import { omit } from "es-toolkit";

import { DrizzleTodoCategoryRepository } from "#api/modules/planning/categories/infrastructure/persistence/drizzle-todo-category.repository";
import { todo, user } from "#api/platform/database/schema/index";
import { describeTodoCategoryRepositoryContract } from "#test/contracts/planning/todo-category-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoFixture, UserFixture } from "#test/fixtures/index";
import {
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleTodoCategoryRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: TODO_FIXTURE_USER_ID, userTag: "PLANTC01" }),
        UserFixture.create({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "PLANTC02" }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeTodoCategoryRepositoryContract(async () => ({
    categoryRepository: new DrizzleTodoCategoryRepository(
      createDatabaseTransactionFixture(client).txHost,
      new DateClock(),
    ),
    async seedTodo(categoryId, options) {
      await client.insert(todo).values(
        omit(
          TodoFixture.create({
            userId: TODO_FIXTURE_USER_ID,
            categoryId,
            completed: options?.completed ?? false,
          }),
          ["id"],
        ),
      );
    },
  }));
});

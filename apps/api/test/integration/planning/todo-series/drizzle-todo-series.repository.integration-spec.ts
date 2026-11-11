import { omit } from "es-toolkit";

import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { todoCategory, user } from "#api/platform/database/schema/index";
import { describeTodoSeriesRepositoryContract } from "#test/contracts/planning/todo-series-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import {
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleTodoSeriesRepository (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: TODO_FIXTURE_USER_ID, userTag: "PLANTS01" }),
        UserFixture.create({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "PLANTS02" }),
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

  describeTodoSeriesRepositoryContract(async () => ({
    seriesRepository: new DrizzleTodoSeriesRepository(
      createDatabaseTransactionFixture(client).txHost,
      new DateClock(),
    ),
    categoryId,
  }));
});

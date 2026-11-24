import { omit } from "es-toolkit";

import { DrizzleTodoImportItemRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import-item.repository";
import { DrizzleTodoImportLinkRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import-link.repository";
import { DrizzleTodoImportRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import.repository";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { describeTodoImportItemRepositoryContract } from "#test/contracts/planning/todo-import-item-repository.contract";
import { describeTodoImportLinkRepositoryContract } from "#test/contracts/planning/todo-import-link-repository.contract";
import { describeTodoImportRepositoryContract } from "#test/contracts/planning/todo-import-repository.contract";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_OTHER_USER_ID,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";
import {
  createTodoCategoryRowFixture,
  createTodoRowFixture,
} from "#test/fixtures/planning/todo-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("가져오기 Drizzle 저장소 (실제 PostgreSQL)", () => {
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
        createUserRowFixture({ id: TODO_IMPORT_FIXTURE_USER_ID, userTag: "IMPORT01" }),
        createUserRowFixture({ id: TODO_IMPORT_FIXTURE_OTHER_USER_ID, userTag: "IMPORT02" }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function transactionHost() {
    return createDatabaseTransactionFixture(client).transactionHost;
  }

  async function seedImport() {
    const todoImport = createTodoImportFixture();
    await new DrizzleTodoImportRepository(transactionHost()).save(todoImport);
    return todoImport.id;
  }

  async function seedTodo(userId: string, categoryId: number): Promise<number> {
    const [row] = await client
      .insert(todo)
      .values(omit(createTodoRowFixture({ userId, categoryId }), ["id"]))
      .returning({ id: todo.id });
    if (row == null) {
      throw new Error("todo seed failed");
    }
    return row.id;
  }

  describeTodoImportRepositoryContract(
    async () => new DrizzleTodoImportRepository(transactionHost()),
  );

  describeTodoImportItemRepositoryContract(async () => ({
    items: new DrizzleTodoImportItemRepository(transactionHost()),
    importId: await seedImport(),
  }));

  describeTodoImportLinkRepositoryContract(async () => {
    const [mine, others] = await client
      .insert(todoCategory)
      .values([
        omit(createTodoCategoryRowFixture({ userId: TODO_IMPORT_FIXTURE_USER_ID }), ["id"]),
        omit(createTodoCategoryRowFixture({ userId: TODO_IMPORT_FIXTURE_OTHER_USER_ID }), ["id"]),
      ])
      .returning({ id: todoCategory.id });
    if (mine == null || others == null) {
      throw new Error("category seed failed");
    }
    return {
      links: new DrizzleTodoImportLinkRepository(transactionHost()),
      importId: await seedImport(),
      todoIds: [
        await seedTodo(TODO_IMPORT_FIXTURE_USER_ID, mine.id),
        await seedTodo(TODO_IMPORT_FIXTURE_USER_ID, mine.id),
        await seedTodo(TODO_IMPORT_FIXTURE_USER_ID, mine.id),
        await seedTodo(TODO_IMPORT_FIXTURE_OTHER_USER_ID, others.id),
      ],
    };
  });
});

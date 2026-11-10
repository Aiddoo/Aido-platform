import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";

import { TODO_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders.public";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { RemoveCategoryTodosUseCase } from "#api/modules/planning/todos/application/use-cases/remove-category-todos.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { DrizzleTodoBulkRemoverAdapter } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-bulk-remover.adapter";
import { createEntityId } from "#api/platform/database/entity-id";
import { todoCategory, todoSeries, user as userTable } from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import {
  countTodoRows,
  insertCategoryTodos,
  type SeededCategoryTodos,
} from "#test/fixtures/planning/category-todos.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SCHEMA = "pgboss";
const NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
// 리마인더가 아직 미래에 있도록 실제 시각보다 넉넉히 뒤 날짜를 쓴다
const FUTURE_DATE = "2099-03-01";

describe("카테고리의 할 일을 한꺼번에 지운다 (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let reminders: ReminderSchedulerAdapter;
  let uow: UnitOfWorkPort;
  let useCase: RemoveCategoryTodosUseCase;
  let ownerId: string;
  let removedCategoryId: number;
  let keptCategoryId: number;
  let removed: SeededCategoryTodos;
  let kept: SeededCategoryTodos;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({ connectionString, schema: SCHEMA, migrate: false, max: 3 });
    const transaction = createDatabaseTransactionFixture(client);
    uow = transaction.uow;
    jobQueue = new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
      shutdownTimeoutMs: 10_000,
    });
    await jobQueue.start();
    reminders = new ReminderSchedulerAdapter(
      new TodoReminderSchedulerAdapter(jobQueue, new FixedClock(NOW)),
    );
    useCase = new RemoveCategoryTodosUseCase({
      bulkRemover: new DrizzleTodoBulkRemoverAdapter(transaction.txHost),
      reminderScheduler: reminders,
      todoCache: new FakeTodoCache(),
      afterCommit: new RecordingAfterCommitRegistry(),
    });
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.execute(
      sql.raw(`DELETE FROM ${SCHEMA}.job WHERE name = '${TODO_REMINDER_QUEUE}'`),
    );
    const owner = UserFixture.create({
      id: createEntityId(),
      email: "category-owner@example.com",
      userTag: "CATOWN01",
    });
    const friend = UserFixture.create({
      id: createEntityId(),
      email: "category-friend@example.com",
      userTag: "CATFRN01",
    });
    await client.insert(userTable).values([owner, friend]);
    ownerId = owner.id;
    const categories = await client
      .insert(todoCategory)
      .values([
        omit(TodoCategoryFixture.create({ userId: ownerId, sortOrder: 0 }), ["id"]),
        omit(TodoCategoryFixture.create({ userId: ownerId, sortOrder: 1 }), ["id"]),
      ])
      .returning();
    removedCategoryId = categories[0]?.id ?? 0;
    keptCategoryId = categories[1]?.id ?? 0;
    const seed = { userId: ownerId, friendId: friend.id, startDate: FUTURE_DATE };
    removed = await insertCategoryTodos(client, {
      ...seed,
      categoryId: removedCategoryId,
      todoCount: 30,
      seriesCount: 2,
    });
    kept = await insertCategoryTodos(client, {
      ...seed,
      categoryId: keptCategoryId,
      todoCount: 4,
      seriesCount: 1,
    });
    await reminders.scheduleReminders(
      [...removed.scheduledTodos, ...kept.scheduledTodos].map((scheduled) => ({
        ...scheduled,
        userId: ownerId,
      })),
    );
  });

  afterAll(async () => {
    await jobQueue?.stop();
    await database?.stop();
  });

  async function queuedReminderTodoIds(): Promise<number[]> {
    const scheduled = [...removed.scheduledTodos, ...kept.scheduledTodos];
    const queued: number[] = [];
    for (const { todoId } of scheduled) {
      const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, {
        key: `reminder_${todoId}_60min`,
        queued: true,
      });
      queued.push(...jobs.map(() => todoId));
    }
    return queued;
  }

  function seriesCountOf(categoryId: number): Promise<number> {
    return client.$count(todoSeries, eq(todoSeries.categoryId, categoryId));
  }

  function removeCategoryTodos() {
    return useCase.execute({
      userId: UserId.reconstitute(ownerId),
      categoryId: TodoCategoryId.reconstitute(removedCategoryId),
    });
  }

  it("할 일·하위 행·반복 규칙·리마인더를 지우고 다른 카테고리는 그대로 둔다", async () => {
    // Given
    const keptRows = await countTodoRows(client, kept.todoIds);

    // When
    const result = await uow.run(() => removeCategoryTodos());

    // Then
    expect(result).toEqual({ todoCount: 30, seriesCount: 2 });
    expect(await countTodoRows(client, removed.todoIds)).toEqual({
      todos: 0,
      items: 0,
      comments: 0,
      views: 0,
      nudges: 0,
    });
    expect(await seriesCountOf(removedCategoryId)).toBe(0);
    expect(await countTodoRows(client, kept.todoIds)).toEqual(keptRows);
    expect(await seriesCountOf(keptCategoryId)).toBe(1);
    expect(await queuedReminderTodoIds()).toEqual(
      kept.scheduledTodos.map((scheduled) => scheduled.todoId),
    );
  });

  it("같은 트랜잭션의 뒤 단계가 실패하면 지운 행과 리마인더 취소가 함께 롤백된다", async () => {
    // Given
    const before = await countTodoRows(client, removed.todoIds);
    const queuedBefore = await queuedReminderTodoIds();

    // When
    const removal = uow.run(async () => {
      await removeCategoryTodos();
      throw new Error("카테고리 삭제 실패");
    });

    // Then
    await expect(removal).rejects.toThrow("카테고리 삭제 실패");
    expect(await countTodoRows(client, removed.todoIds)).toEqual(before);
    expect(await seriesCountOf(removedCategoryId)).toBe(2);
    expect(await queuedReminderTodoIds()).toEqual(queuedBefore);
  });
});

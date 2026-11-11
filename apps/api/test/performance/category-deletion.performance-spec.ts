import { performance } from "node:perf_hooks";

import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";

import { TODO_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders.public";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { DeleteTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/delete-todo-category.use-case";
import { DrizzleTodoCategoryRepository } from "#api/modules/planning/categories/infrastructure/persistence/drizzle-todo-category.repository";
import { RemoveCategoryTodosUseCase } from "#api/modules/planning/todos/application/use-cases/remove-category-todos.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { DrizzleTodoBulkRemoverAdapter } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-bulk-remover.adapter";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { FakeTodoCategoryCache } from "#test/doubles/planning/fake-todo-category-cache";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import { countTodoRows, insertCategoryTodos } from "#test/fixtures/planning/category-todos.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SCHEMA = "pgboss";
const TODO_COUNT = 5000;
const SERIES_COUNT = 20;
const OTHER_USERS = 20;
const OTHER_TODOS_PER_USER = 1000;
// 운영 최대는 419개(p99 172개)다. 열 배가 넘는 카테고리도 요청 하나 안에서 끝나야 한다
const BUDGET_MS = 2000;
const FUTURE_DATE = "2099-01-01";

/** 수동 측정 전용. 일반 unit/integration/E2E와 CI에는 포함하지 않는다. */
describe("카테고리 삭제 규모 측정 (할 일 5,000개)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let reminders: ReminderSchedulerAdapter;
  let useCase: DeleteTodoCategoryUseCase;
  let statements = 0;

  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 6 }, () => {
          statements += 1;
        }),
    });
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({ connectionString, schema: SCHEMA, migrate: false, max: 3 });
    const transaction = createDatabaseTransactionFixture(client);
    jobQueue = new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
      shutdownTimeoutMs: 10_000,
    });
    await jobQueue.start();
    reminders = new ReminderSchedulerAdapter(
      new TodoReminderSchedulerAdapter(jobQueue, new DateClock()),
    );
    useCase = new DeleteTodoCategoryUseCase({
      repository: new DrizzleTodoCategoryRepository(transaction.txHost, new DateClock()),
      categoryTodos: new RemoveCategoryTodosUseCase({
        bulkRemover: new DrizzleTodoBulkRemoverAdapter(transaction.txHost),
        reminderScheduler: reminders,
        todoCache: new FakeTodoCache(),
        afterCommit: new RecordingAfterCommitRegistry(),
      }),
      cache: new FakeTodoCategoryCache(),
      todoCache: new FakeTodoCache(),
      afterCommit: new RecordingAfterCommitRegistry(),
      mutationLock: new PostgresMutationLockAdapter(transaction.txHost),
      unitOfWork: transaction.uow,
      clock: new DateClock(),
      eventPublisher: new RecordingDomainEventPublisher(),
      logger: new SilentLogger(),
    });
    await seedOtherUsers();
  }, 300_000);

  afterAll(async () => {
    await jobQueue?.stop();
    await database?.stop();
  });

  async function insertUser(label: string): Promise<string> {
    const created = UserFixture.create({
      id: createEntityId(),
      email: `${label}-${createEntityId()}@example.com`,
      userTag: createEntityId().slice(-8).toUpperCase(),
    });
    await client.insert(userTable).values(created);
    return created.id;
  }

  async function insertCategories(userId: string, count: number): Promise<number[]> {
    const rows = await client
      .insert(todoCategory)
      .values(
        Array.from({ length: count }, (_, sortOrder) =>
          omit(TodoCategoryFixture.create({ userId, sortOrder }), ["id"]),
        ),
      )
      .returning({ id: todoCategory.id });
    return rows.map((row) => row.id);
  }

  // 다른 사용자의 할 일이 섞여 있어야 (userId, categoryId) 인덱스를 타는지가 시간에 드러난다
  async function seedOtherUsers(): Promise<void> {
    const friendId = await insertUser("friend");
    for (let index = 0; index < OTHER_USERS; index += 1) {
      const userId = await insertUser("other");
      const [categoryId] = await insertCategories(userId, 1);
      await insertCategoryTodos(client, {
        userId,
        categoryId: categoryId ?? 0,
        friendId,
        todoCount: OTHER_TODOS_PER_USER,
        seriesCount: 0,
        startDate: FUTURE_DATE,
      });
    }
  }

  async function seedLargeCategory() {
    const userId = await insertUser("owner");
    const friendId = await insertUser("friend");
    const [categoryId = 0, targetId = 0] = await insertCategories(userId, 2);
    const seeded = await insertCategoryTodos(client, {
      userId,
      categoryId,
      friendId,
      todoCount: TODO_COUNT,
      seriesCount: SERIES_COUNT,
      startDate: FUTURE_DATE,
    });
    await reminders.scheduleReminders(
      seeded.scheduledTodos.map((scheduled) => ({ ...scheduled, userId })),
    );
    await client.execute(sql`ANALYZE`);
    return { userId, categoryId, targetId, seeded };
  }

  async function queuedReminderCount(todoIds: readonly number[]): Promise<number> {
    const result = await client.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM pgboss.job
      WHERE name = ${TODO_REMINDER_QUEUE} AND state = 'created'
        AND (data->'data'->>'todoId')::int = ANY(${sql.param([...todoIds])}::int[])`);
    return result.rows[0]?.count ?? -1;
  }

  async function measure(work: () => Promise<unknown>) {
    statements = 0;
    const startedAt = performance.now();
    const result = await work();
    return {
      result,
      durationMs: Math.round(performance.now() - startedAt),
      statements,
    };
  }

  it("옮기기", async () => {
    // Given
    const { userId, categoryId, targetId, seeded } = await seedLargeCategory();

    // When
    const measured = await measure(() =>
      useCase.execute({ userId, categoryId, todoHandling: "move", moveToCategoryId: targetId }),
    );

    // Then
    console.log(JSON.stringify({ scenario: "move", todos: TODO_COUNT, ...measured }));
    expect(measured.result).toMatchObject({ todoHandling: "move", todoCount: TODO_COUNT });
    expect(await client.$count(todo, eq(todo.categoryId, targetId))).toBe(TODO_COUNT);
    expect(await client.$count(todoSeries, eq(todoSeries.categoryId, targetId))).toBe(SERIES_COUNT);
    expect(await queuedReminderCount(seeded.todoIds)).toBe(seeded.scheduledTodos.length * 2);
    expect(measured.durationMs).toBeLessThan(BUDGET_MS);
  });

  it("함께 지우기", async () => {
    // Given
    const { userId, categoryId, seeded } = await seedLargeCategory();
    const queuedBefore = await queuedReminderCount(seeded.todoIds);

    // When
    const measured = await measure(() =>
      useCase.execute({ userId, categoryId, todoHandling: "delete" }),
    );

    // Then
    console.log(
      JSON.stringify({ scenario: "delete", todos: TODO_COUNT, queuedBefore, ...measured }),
    );
    expect(measured.result).toMatchObject({
      todoHandling: "delete",
      todoCount: TODO_COUNT,
      seriesCount: SERIES_COUNT,
    });
    expect(await countTodoRows(client, seeded.todoIds)).toEqual({
      todos: 0,
      items: 0,
      comments: 0,
      views: 0,
      nudges: 0,
    });
    expect(await queuedReminderCount(seeded.todoIds)).toBe(0);
    expect(measured.durationMs).toBeLessThan(BUDGET_MS);
  });
});

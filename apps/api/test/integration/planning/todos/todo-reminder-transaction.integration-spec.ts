import { sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";

import { TODO_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders.public";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { ApplyTodoEventsUseCase } from "#api/modules/planning/todos/application/use-cases/apply-todo-events.use-case";
import { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/resolve-todo-timezone.use-case";
import { SetTodoCompletedUseCase } from "#api/modules/planning/todos/application/use-cases/set-todo-completed.use-case";
import { UpdateTodoScheduleUseCase } from "#api/modules/planning/todos/application/use-cases/update-todo-schedule.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { todo, todoCategory, user as userTable } from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import type {
  DomainEventPublisherPort,
  PublishedDomainEvent,
} from "#api/shared/application/ports/domain-event-publisher.port";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SCHEMA = "pgboss";
const SEOUL = "Asia/Seoul";
// 리마인더가 아직 미래에 있도록 실제 시각보다 넉넉히 뒤 날짜를 쓴다
const FUTURE_DATE = "2099-03-10";

class SwitchablePublisher implements Pick<DomainEventPublisherPort, "publish"> {
  readonly published: PublishedDomainEvent[] = [];
  failsOnPublish = false;

  async publish(events: readonly PublishedDomainEvent[]): Promise<void> {
    if (this.failsOnPublish) {
      throw new Error("구독 payload 검증 실패");
    }
    this.published.push(...events);
  }
}

describe("할 일 리마인더를 같은 트랜잭션에서 예약·취소한다 (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let runtime: PgBossJobRuntimeAdapter;
  let reminderAdapter: ReminderSchedulerAdapter;
  let publisher: SwitchablePublisher;
  let updateSchedule: UpdateTodoScheduleUseCase;
  let setCompleted: SetTodoCompletedUseCase;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({ connectionString, schema: SCHEMA, migrate: false, max: 3 });
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    runtime = new PgBossJobRuntimeAdapter(boss, txHost, { shutdownTimeoutMs: 10_000 });
    await runtime.start();
    reminderAdapter = new ReminderSchedulerAdapter(
      new TodoReminderSchedulerAdapter(
        new PgBossJobQueueAdapter(boss, txHost, new JobQueueRegistry()),
        new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
      ),
    );
    publisher = new SwitchablePublisher();
    const todoRepository = new DrizzleTodoRepository(txHost, new DateClock());
    const todoReadRepository = new DrizzleTodoReadRepository(txHost);
    const mutationLock = new PostgresMutationLockAdapter(txHost);
    const todoCache = { invalidateFriendTodos: async () => undefined };
    const applyTodoEvents = new ApplyTodoEventsUseCase({
      reminderScheduler: reminderAdapter,
      eventPublisher: publisher,
      clock: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
    });
    updateSchedule = new UpdateTodoScheduleUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork: uow,
      applyTodoEvents,
      mutationLock,
      clock: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
      timezoneResolver: new ResolveTodoTimezoneUseCase({
        ownerTimezone: { findTimezone: async () => SEOUL },
      }),
      todoCache,
      logger: new SilentLogger(),
    });
    setCompleted = new SetTodoCompletedUseCase({
      clock: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
      todoRepository,
      todoReadRepository,
      unitOfWork: uow,
      applyTodoEvents,
      mutationLock,
      todoCache,
      completionEffects: { execute: async () => undefined },
      logger: new SilentLogger(),
    });
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.execute(
      sql.raw(`DELETE FROM ${SCHEMA}.job WHERE name = '${TODO_REMINDER_QUEUE}'`),
    );
    publisher.failsOnPublish = false;
    publisher.published.length = 0;
    const user = UserFixture.create({
      id: createEntityId(),
      email: "reminder-tx@example.com",
      userTag: "REMTX001",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    categoryId = category?.id ?? 0;
  });

  afterAll(async () => {
    await runtime?.stop();
    await database?.stop();
  });

  async function seedTodo(scheduled: boolean) {
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId, categoryId }), ["id"]),
        startDate: Temporal.PlainDate.from(FUTURE_DATE),
        scheduledLocalTime: scheduled ? "10:00" : null,
        scheduledTime: scheduled
          ? instantFromDate(parseLocalDateTime(FUTURE_DATE, "10:00", SEOUL))
          : null,
        isAllDay: !scheduled,
        completed: false,
      })
      .returning();
    return row?.id ?? 0;
  }

  async function queuedReminderKeys(todoId: number) {
    const keys: string[] = [];
    for (const label of ["10min", "60min"]) {
      const key = `reminder_${todoId}_${label}`;
      const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, { key, queued: true });
      keys.push(...jobs.map(() => key));
    }
    return keys;
  }

  function moveTo1030(todoId: number) {
    return updateSchedule.execute({
      id: todoId,
      userId,
      schedule: {
        startDate: Temporal.PlainDate.from(FUTURE_DATE),
        endDate: null,
        scheduledTime: "10:30",
        isAllDay: false,
      },
      timezone: SEOUL,
    });
  }

  it("일정 변경이 커밋되면 리마인더 작업과 planning.todo.rescheduled가 함께 남는다", async () => {
    // Given
    const todoId = await seedTodo(false);

    // When
    await moveTo1030(todoId);

    // Then
    expect(await queuedReminderKeys(todoId)).toEqual([
      `reminder_${todoId}_10min`,
      `reminder_${todoId}_60min`,
    ]);
    expect(publisher.published.map((event) => event.eventName)).toEqual([
      "planning.todo.rescheduled",
    ]);
  });

  it("같은 트랜잭션의 뒤 단계가 실패하면 리마인더 작업도 롤백되어 남지 않는다", async () => {
    // Given
    const todoId = await seedTodo(false);
    publisher.failsOnPublish = true;

    // When
    const updating = moveTo1030(todoId);

    // Then
    await expect(updating).rejects.toThrow("구독 payload 검증 실패");
    expect(await queuedReminderKeys(todoId)).toEqual([]);
    const row = await client.query.todo.findFirst({ where: { id: todoId } });
    expect(row?.scheduledLocalTime).toBeNull();
  });

  it("완료가 롤백되면 리마인더 취소도 롤백되어 예약이 그대로 남는다", async () => {
    // Given
    const todoId = await seedTodo(true);
    await reminderAdapter.scheduleReminders([
      {
        todoId,
        scheduledTime: instantFromDate(parseLocalDateTime(FUTURE_DATE, "10:00", SEOUL)),
        userId,
      },
    ]);
    publisher.failsOnPublish = true;

    // When
    const completing = setCompleted.execute({
      id: todoId,
      userId,
      completed: true,
      timezone: SEOUL,
    });

    // Then
    await expect(completing).rejects.toThrow("구독 payload 검증 실패");
    expect(await queuedReminderKeys(todoId)).toHaveLength(2);
    const row = await client.query.todo.findFirst({ where: { id: todoId } });
    expect(row?.completed).toBe(false);
  });

  it("완료가 커밋되면 리마인더가 지워지고 planning.todo.completed가 나간다", async () => {
    // Given
    const todoId = await seedTodo(true);
    await reminderAdapter.scheduleReminders([
      {
        todoId,
        scheduledTime: instantFromDate(parseLocalDateTime(FUTURE_DATE, "10:00", SEOUL)),
        userId,
      },
    ]);

    // When
    await setCompleted.execute({ id: todoId, userId, completed: true, timezone: SEOUL });

    // Then
    expect(await queuedReminderKeys(todoId)).toEqual([]);
    expect(publisher.published.map((event) => event.eventName)).toEqual([
      "planning.todo.completed",
    ]);
    const row = await client.query.todo.findFirst({ where: { id: todoId } });
    expect(row?.completed).toBe(true);
  });
});

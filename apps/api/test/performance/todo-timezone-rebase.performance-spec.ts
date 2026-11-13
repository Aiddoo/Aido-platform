import { performance } from "node:perf_hooks";

import { sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";

import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { RebaseTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/rebase-todo-timezone.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  todoCategory,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

const SCHEMA = "pgboss";
const NEW_YORK = "America/New_York";
const DAYS = 90;

/** 수동 측정 전용. 일반 unit/integration/E2E와 CI에는 포함하지 않는다. */
describe("시간대 재계산 규모 측정", () => {
  it.each([
    { name: "새 경로 상한", seriesCount: 30, days: DAYS, historyRows: 0, otherUsers: 0 },
    { name: "옛 경로 상한", seriesCount: 300, days: DAYS, historyRows: 0, otherUsers: 0 },
    { name: "전체 이력 5만 행", seriesCount: 30, days: DAYS, historyRows: 47_300, otherUsers: 0 },
    {
      name: "전체 이력 5만 행 + 다른 사용자 20만 행",
      seriesCount: 30,
      days: DAYS,
      historyRows: 47_300,
      otherUsers: 200,
    },
  ])(
    "$name",
    async ({ seriesCount, days, historyRows, otherUsers }) => {
      let statements = 0;
      const database = new TestDatabase({
        createClient: (url) =>
          createTestClient(url, { max: 6 }, () => {
            statements += 1;
          }),
      });
      const client = await database.start();
      const connectionString = database.getConnectionUri();
      const migrator = new PgBoss({
        connectionString,
        schema: SCHEMA,
        migrate: true,
        createSchema: true,
      });
      await migrator.start();
      await migrator.stop({ graceful: true, timeout: 10_000, close: true });
      const boss = new PgBoss({
        connectionString,
        schema: SCHEMA,
        migrate: false,
        createSchema: false,
        max: 3,
      });
      const transaction = createDatabaseTransactionFixture(client);
      const jobQueue = new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
        shutdownTimeoutMs: 10_000,
      });
      await jobQueue.start();
      try {
        const user = UserFixture.create({
          id: createEntityId(),
          email: `scale-${createEntityId()}@example.com`,
          userTag: createEntityId().slice(-8).toUpperCase(),
        });
        await client.insert(userTable).values(user);
        await client.insert(userPreference).values({ userId: user.id, timezone: NEW_YORK });
        const [category] = await client
          .insert(todoCategory)
          .values(omit(TodoCategoryFixture.create({ userId: user.id, sortOrder: 0 }), ["id"]))
          .returning();
        const seriesIds = Array.from({ length: seriesCount }, () => createEntityId());
        await client.execute(sql`
        INSERT INTO "TodoSeries" ("id", "originSeriesId", "userId", "categoryId", "title", "timezone", "repeatFrequency", "startDate", "nextOccurrenceDate", "scheduledLocalTime", "updatedAt")
        SELECT id, id, ${user.id}, ${category?.id}, '규칙', 'Asia/Seoul', 'DAILY', CURRENT_DATE, CURRENT_DATE + 91, '10:00', now()
        FROM unnest(${sql.param(seriesIds)}::text[]) AS id`);
        await client.execute(sql`
        INSERT INTO "Todo" ("userId", "categoryId", "title", "startDate", "occurrenceDate", "recurrenceGroupId", "scheduledLocalTime", "scheduledTime", "isAllDay", "updatedAt")
        SELECT ${user.id}, ${category?.id}, '회차', CURRENT_DATE + day, CURRENT_DATE + day, id, '10:00',
          ((CURRENT_DATE + day)::timestamp + time '10:00') AT TIME ZONE 'Asia/Seoul', false, now()
        FROM unnest(${sql.param(seriesIds)}::text[]) AS id, generate_series(1, ${days}) AS day`);
        // 지난 이력은 대부분 완료했고 날짜가 흩어져 있다.
        await client.execute(sql`
        INSERT INTO "Todo" ("userId", "categoryId", "title", "startDate", "scheduledLocalTime", "scheduledTime", "isAllDay", "completed", "completedAt", "updatedAt")
        SELECT ${user.id}, ${category?.id}, '지난 할 일', CURRENT_DATE - (n % 1500) - 1, '10:00',
          ((CURRENT_DATE - (n % 1500) - 1)::timestamp + time '10:00') AT TIME ZONE 'Asia/Seoul', false,
          n % 10 <> 0, CASE WHEN n % 10 <> 0 THEN now() END, now()
        FROM generate_series(1, ${historyRows}) AS n`);
        for (let index = 0; index < otherUsers; index += 1) {
          const other = UserFixture.create({
            id: createEntityId(),
            email: `other-${createEntityId()}@example.com`,
            userTag: createEntityId().slice(-8).toUpperCase(),
          });
          await client.insert(userTable).values(other);
          const [otherCategory] = await client
            .insert(todoCategory)
            .values(omit(TodoCategoryFixture.create({ userId: other.id, sortOrder: 0 }), ["id"]))
            .returning();
          await client.execute(sql`
          INSERT INTO "Todo" ("userId", "categoryId", "title", "startDate", "scheduledLocalTime", "scheduledTime", "isAllDay", "completed", "updatedAt")
          SELECT ${other.id}, ${otherCategory?.id}, '다른 사용자', CURRENT_DATE - n, '10:00', now(), false, true, now()
          FROM generate_series(1, 1000) AS n`);
        }
        await client.execute(sql`ANALYZE "Todo"`);
        const reminders = new ReminderSchedulerAdapter(
          new TodoReminderSchedulerAdapter(jobQueue, new DateClock()),
        );
        const useCase = new RebaseTodoTimezoneUseCase({
          clock: new DateClock(),
          todoRepository: new DrizzleTodoRepository(transaction.txHost, new DateClock()),
          seriesRepository: new DrizzleTodoSeriesRepository(transaction.txHost, new DateClock()),
          ownerTimezone: {
            findTimezone: async (id) => {
              const row = await transaction.txHost.tx.query.userPreference.findFirst({
                columns: { timezone: true },
                where: { userId: id.value },
              });
              return row?.timezone ?? null;
            },
          },
          todoReminder: reminders,
          todoCache: { invalidateFriendTodos: async () => undefined },
          unitOfWork: transaction.uow,
          mutationLock: new PostgresMutationLockAdapter(transaction.txHost),
          logger: { log: () => undefined },
        });

        global.gc?.();
        const heapBefore = process.memoryUsage().heapUsed;
        let heapPeak = heapBefore;
        const sampler = setInterval(() => {
          heapPeak = Math.max(heapPeak, process.memoryUsage().heapUsed);
        }, 20);
        statements = 0;
        const startedAt = performance.now();
        const result = await useCase.execute({ userId: user.id });
        const durationMs = Math.round(performance.now() - startedAt);
        clearInterval(sampler);
        const firstStatements = statements;
        const queued = await client.execute<{ count: string }>(
          sql`SELECT count(*) FROM pgboss.job WHERE name = 'todo-reminder.v1' AND state = 'created'`,
        );
        const plan = await client.execute<{ "QUERY PLAN": string }>(sql`
          EXPLAIN (ANALYZE, BUFFERS) SELECT id, "startDate", "scheduledLocalTime", "scheduledTime", completed FROM "Todo"
          WHERE "userId" = ${user.id} AND "scheduledTime" IS NOT NULL AND id > 0
          ORDER BY id LIMIT 500 FOR UPDATE`);

        statements = 0;
        const repeatedAt = performance.now();
        const repeated = await useCase.execute({ userId: user.id });
        const repeatedMs = Math.round(performance.now() - repeatedAt);

        const measured = {
          seriesCount,
          historyRows,
          otherRows: otherUsers * 1000,
          rows: result.scannedCount,
          queuedReminderJobs: Number(queued.rows[0]?.count),
          rebased: result.rebasedCount,
          drizzleStatements: firstStatements,
          durationMs,
          heapPeakDeltaMb: Math.round((heapPeak - heapBefore) / 1024 / 1024),
          repeatedRebased: repeated.rebasedCount,
          repeatedStatements: statements,
          repeatedMs,
        };
        console.log(JSON.stringify(measured));
        console.log(plan.rows.map((line) => line["QUERY PLAN"]).join("\n"));
        expect(result.rebasedCount).toBe(seriesCount * days + historyRows);
        expect(repeated.rebasedCount).toBe(0);
      } finally {
        await jobQueue.stop();
        await database.stop();
      }
    },
    300_000,
  );
});

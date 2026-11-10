import { performance } from "node:perf_hooks";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";

import type { AggregateParams } from "#api/modules/ai-assistance/reports/domain/ai-report.constants";
import { assembleAggregatedData } from "#api/modules/ai-assistance/reports/domain/report-aggregation.domain-service";
import { DrizzleTodoStatsReader } from "#api/modules/ai-assistance/reports/infrastructure/persistence/drizzle-todo-stats.reader";
import { requireRecord } from "#api/platform/database/database-error.util";
import { todo, todoCategory, user as userTable } from "#api/platform/database/schema/index";
import { parseLocalDateTime, startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { plainDateFromDate, plainDateToDate } from "#api/shared/domain/time/plain-date";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

/** 수동 측정 전용. 일반 unit/integration/E2E와 CI에는 포함하지 않는다. */
it("같은 PostgreSQL·pool·데이터에서 기존 8쿼리와 준비된 ORM 집계 5쿼리를 교차 측정한다", async () => {
  let module: TestingModule | undefined;
  let recordedStatements: number | undefined;
  const onStatement = () => {
    if (recordedStatements !== undefined) {
      recordedStatements += 1;
    }
  };
  const countStatements = async (fetch: () => Promise<unknown>): Promise<number> => {
    recordedStatements = 0;
    try {
      await fetch();
      return recordedStatements;
    } finally {
      recordedStatements = undefined;
    }
  };
  let pooledConnections: (() => number) | undefined;
  const testDb = new TestDatabase({
    createClient: (connectionUri) => {
      const client = createTestClient(connectionUri, {}, onStatement);
      pooledConnections = () => client.$client.totalCount;
      return client;
    },
  });
  try {
    const client = await testDb.start();
    module = await Test.createTestingModule({
      providers: [
        DrizzleTodoStatsReader,
        {
          provide: TransactionHost,
          useValue: { tx: client, isTransactionActive: () => false },
        },
      ],
    }).compile();
    const reader = module.get(DrizzleTodoStatsReader);
    const measure = async (fetch: () => Promise<unknown>) => {
      const samples: number[] = [];
      const cpu = process.cpuUsage();
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await fetch();
        samples.push(performance.now() - start);
      }
      const elapsedCpu = process.cpuUsage(cpu);
      return { samples, cpuMs: (elapsedCpu.user + elapsedCpu.system) / 1_000 };
    };
    const summarize = (rounds: Awaited<ReturnType<typeof measure>>[]) => {
      const samples = rounds.flatMap((round) => round.samples).sort((a, b) => a - b);
      return {
        p50Ms: samples[Math.floor(samples.length * 0.5)],
        p95Ms: samples[Math.floor(samples.length * 0.95)],
        cpuMs: rounds.reduce((total, round) => total + round.cpuMs, 0),
      };
    };
    // 같은 날짜 계약의 8조회 기준이다. 과거 날짜 버그나 서로 다른 ORM 버전의 성능을 비교하지 않는다.
    const baseline = async (params: AggregateParams) => {
      const { userId, startDate, endDate, prevStartDate, prevEndDate } = params;
      const day = (value: Date) => plainDateFromDate(startOfDayInTimezone(value, params.timezone));
      const inRange = (from: Date, to: Date) =>
        and(eq(todo.userId, userId), gte(todo.startDate, day(from)), lt(todo.startDate, day(to)));
      const [
        dailyTotalGroups,
        dailyCompletedGroups,
        prevTotalCount,
        prevCompletedCount,
        catTotalGroups,
        catCompletedGroups,
        categories,
        completedTodos,
      ] = await Promise.all([
        client
          .select({ startDate: todo.startDate, _count: { id: count() } })
          .from(todo)
          .where(inRange(startDate, endDate))
          .groupBy(todo.startDate),
        client
          .select({ startDate: todo.startDate, _count: { id: count() } })
          .from(todo)
          .where(and(inRange(startDate, endDate), eq(todo.completed, true)))
          .groupBy(todo.startDate),
        client
          .select({ count: count() })
          .from(todo)
          .where(inRange(prevStartDate, prevEndDate))
          .then((rows) => requireRecord(rows[0]).count),
        client
          .select({ count: count() })
          .from(todo)
          .where(and(inRange(prevStartDate, prevEndDate), eq(todo.completed, true)))
          .then((rows) => requireRecord(rows[0]).count),
        client
          .select({ categoryId: todo.categoryId, _count: { id: count() } })
          .from(todo)
          .where(inRange(startDate, endDate))
          .groupBy(todo.categoryId),
        client
          .select({ categoryId: todo.categoryId, _count: { id: count() } })
          .from(todo)
          .where(and(inRange(startDate, endDate), eq(todo.completed, true)))
          .groupBy(todo.categoryId),
        client
          .select({ id: todoCategory.id, name: todoCategory.name, color: todoCategory.color })
          .from(todoCategory)
          .where(eq(todoCategory.userId, userId)),
        client
          .select({ startDate: todo.startDate, completedAt: todo.completedAt })
          .from(todo)
          .where(
            and(inRange(startDate, endDate), eq(todo.completed, true), isNotNull(todo.completedAt)),
          ),
      ]);
      // 리포트 집계 입력은 아직 UTC 자정 Date와 Date 순간이다
      const toDateGroup = (group: { startDate: Temporal.PlainDate; _count: { id: number } }) => ({
        ...group,
        startDate: plainDateToDate(group.startDate),
      });
      return {
        dailyTotalGroups: dailyTotalGroups.map(toDateGroup),
        dailyCompletedGroups: dailyCompletedGroups.map(toDateGroup),
        prevTotalCount,
        prevCompletedCount,
        catTotalGroups,
        catCompletedGroups,
        categories,
        completedTodos: completedTodos.map((row) => ({
          startDate: plainDateToDate(row.startDate),
          completedAt: row.completedAt == null ? null : instantToDate(row.completedAt),
        })),
      };
    };
    for (const rowCount of [1_000, 10_000, 100_000]) {
      await testDb.cleanup();
      const user = requireRecord(
        (
          await client
            .insert(userTable)
            .values({
              email: "benchmark@test.aido.app",
              userTag: "BENCH001",
              status: "ACTIVE",
              updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
            })
            .returning()
        )[0],
      );
      const categories = await client
        .insert(todoCategory)
        .values(
          Array.from({ length: 5 }, (_, i) => ({
            userId: user.id,
            name: `category-${i}`,
            color: "#FF0000",
            updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
            sortOrder: i,
          })),
        )
        .returning();
      for (let offset = 0; offset < rowCount; offset += 1_000) {
        await client.insert(todo).values(
          Array.from({ length: Math.min(1_000, rowCount - offset) }, (_, index) => {
            const i = offset + index;
            const startDate = new Date(Date.UTC(2_026, 1, 16 + (i % 14)));
            const category = categories[i % categories.length];
            if (category === undefined) {
              throw new Error("Benchmark category missing");
            }
            return {
              userId: user.id,
              categoryId: category.id,
              title: `todo-${i}`,
              startDate: plainDateFromDate(startDate),
              completed: i % 3 !== 0,
              completedAt:
                i % 3 !== 0
                  ? instantFromDate(
                      new Date(startDate.getTime() + (i % 24) * 3_600_000 + (i % 3_600) * 1_000),
                    )
                  : null,
              updatedAt: nowInstant(),
            };
          }),
        );
      }
      const params = {
        userId: user.id,
        startDate: parseLocalDateTime("2026-02-23", "00:00", "Asia/Seoul"),
        endDate: parseLocalDateTime("2026-03-02", "00:00", "Asia/Seoul"),
        prevStartDate: parseLocalDateTime("2026-02-16", "00:00", "Asia/Seoul"),
        prevEndDate: parseLocalDateTime("2026-02-23", "00:00", "Asia/Seoul"),
        timezone: "Asia/Seoul",
      };
      const legacy = await baseline(params);
      const current = await reader.fetchAggregationInputs(params);
      expect(
        assembleAggregatedData(current, params.startDate, params.endDate, params.timezone),
      ).toEqual(assembleAggregatedData(legacy, params.startDate, params.endDate, params.timezone));
      const beforeRounds: Awaited<ReturnType<typeof measure>>[] = [];
      const afterRounds: Awaited<ReturnType<typeof measure>>[] = [];
      for (let warmup = 0; warmup < 5; warmup++) {
        await baseline(params);
        await reader.fetchAggregationInputs(params);
      }
      const beforeStatements = await countStatements(() => baseline(params));
      const afterStatements = await countStatements(() => reader.fetchAggregationInputs(params));
      expect(beforeStatements).toBe(8);
      expect(afterStatements).toBe(5);
      // 실행 순서와 공유 프로세스의 GC 영향을 줄이도록 6회 교차 측정한다.
      // RSS는 seed와 두 측정이 공유하는 프로세스 값이므로 특정 조회의 사용량으로 표시하지 않는다.
      let sharedPeakRssMiB = process.memoryUsage().rss / 1_024 / 1_024;
      for (let round = 0; round < 6; round++) {
        const before = async () => beforeRounds.push(await measure(() => baseline(params)));
        const after = async () =>
          afterRounds.push(await measure(() => reader.fetchAggregationInputs(params)));
        if (round % 2 === 0) {
          await before();
          await after();
        } else {
          await after();
          await before();
        }
        sharedPeakRssMiB = Math.max(sharedPeakRssMiB, process.memoryUsage().rss / 1_024 / 1_024);
      }
      process.stdout.write(
        `${JSON.stringify({ count: rowCount, before: { ...summarize(beforeRounds), statements: beforeStatements }, after: { ...summarize(afterRounds), statements: afterStatements }, sharedPeakRssMiB, connections: pooledConnections?.() })}\n`,
      );
    }
  } finally {
    try {
      await module?.close();
    } finally {
      await testDb.stop();
    }
  }
}, 180_000);

import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { Module, type DynamicModule } from "@nestjs/common";
/**
 * ReportAggregatorService 통합 테스트 (Testcontainers)
 *
 * @description
 * ReportAggregatorService가 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 컨테이너에서 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - ReportAggregatorService → DatabaseService → Prisma → PostgreSQL 전체 스택 검증
 * - groupBy 결과를 기반으로 한 집계 로직 통합 검증
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test report-aggregator.integration-spec
 * ```
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import postgres from "@prisma/orm-postgres/runtime";
import { ClsModule } from "nestjs-cls";
import { Pool } from "pg";
import { vi } from "vitest";

import {
  TODO_STATS_READER,
  type TodoStatsReaderPort,
} from "#api/modules/ai-assistance/application/ports/reports/todo-stats.reader.port";
import { assembleAggregatedData } from "#api/modules/ai-assistance/domain/services/reports/report-aggregation";
import type {
  AggregatedReportData,
  AggregateParams,
} from "#api/modules/ai-assistance/domain/types/reports/ai-report.types";
import { PrismaTodoStatsReader } from "#api/modules/ai-assistance/infrastructure/persistence/reports/prisma-todo-stats.reader";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { createEntityId, varchar } from "#api/platform/database/database-values";
import { DatabaseService } from "#api/platform/database/database.service";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { createTestDatabaseService } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import { TestDatabase } from "../setup/test-database.js";

@Module({})
class ReportDatabaseTestModule {
  static register(client: TestDatabaseClient): DynamicModule {
    return {
      module: ReportDatabaseTestModule,
      providers: [{ provide: DatabaseService, useValue: createTestDatabaseService(client) }],
      exports: [DatabaseService],
    };
  }
}

describe("ReportAggregator 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let reader: TodoStatsReaderPort;
  let testDb: TestDatabase;
  let prismaClient: TestDatabaseClient;
  let pool: Pool;
  let txHost: TransactionHost<Prisma8TransactionalAdapter>;
  let uow: ClsUnitOfWork;

  /**
   * 리포트 집계: reader(실 DB 조회) + 도메인 계산.
   * (구 ReportAggregatorService.aggregate와 동일 시퀀스 — 서비스 계층 제거)
   */
  const aggregate = async (params: AggregateParams): Promise<AggregatedReportData> => {
    const inputs = await reader.fetchAggregationInputs(params);
    const result = assembleAggregatedData(
      inputs,
      params.startDate,
      params.endDate,
      params.timezone,
    );
    const transactionInputs = await uow.run(() => reader.fetchAggregationInputs(params));
    expect(
      assembleAggregatedData(transactionInputs, params.startDate, params.endDate, params.timezone),
    ).toEqual(result);
    return result;
  };

  // 테스트 사용자 ID
  let testUserId: string;

  // 테스트 스위트 시작 시 한 번만 실행
  beforeAll(async () => {
    suppressLogger();

    // TestContainer 시작 및 Database 연결
    testDb = new TestDatabase({
      createClient: (connectionUri) => {
        pool = new Pool({ connectionString: connectionUri });
        return postgres<Contract>({ contractJson, pg: pool });
      },
    });
    prismaClient = await testDb.start();

    // NestJS 테스트 모듈 생성
    const databaseModule = ReportDatabaseTestModule.register(prismaClient);
    module = await Test.createTestingModule({
      imports: [
        databaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [databaseModule],
              adapter: new Prisma8TransactionalAdapter(),
            }),
          ],
        }),
      ],
      providers: [{ provide: TODO_STATS_READER, useClass: PrismaTodoStatsReader }, ClsUnitOfWork],
    }).compile();

    await module.init();
    reader = module.get<TodoStatsReaderPort>(TODO_STATS_READER);
    txHost = module.get(TransactionHost);
    uow = module.get(ClsUnitOfWork);
  }, 60000); // 컨테이너 시작에 시간이 걸릴 수 있음

  // 각 테스트 전 데이터 초기화
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.cleanup();

    // 테스트 사용자 생성
    const prisma = testDb.getClient();
    const userTag = Date.now().toString(36).toUpperCase().slice(-8);
    const user = decodeRecord(
      "User",
      await createUserDatabaseFixture(
        prisma,
        encodeCreate("User", { email: "test-aggregator@example.com", status: "ACTIVE", userTag }),
        { profile: encodePatch("UserProfile", { id: createEntityId(), name: "테스트 유저" }) },
      ),
    );
    testUserId = user.id;

    // 기본 카테고리 생성
    await prisma.orm.public.TodoCategory.createAndCount(
      [
        {
          userId: testUserId,
          name: "업무",
          color: "#FF0000",
          sortOrder: 0,
        },
        {
          userId: testUserId,
          name: "개인",
          color: "#00FF00",
          sortOrder: 1,
        },
      ].map((value) => encodeCreate("TodoCategory", value)),
    );
  });

  // 테스트 스위트 종료 시 정리
  afterAll(async () => {
    try {
      if (module) {
        await module.get(DatabaseService).onModuleDestroy();
        expect(
          (
            await prismaClient.orm.public.User.aggregate((aggregate) => ({
              count: aggregate.count(),
            }))
          ).count,
        ).toBeGreaterThan(0);
        await module.close();
      }
    } finally {
      if (testDb) {
        await testDb.stop();
        await pool.end();
      }
    }
  });

  /**
   * 테스트 할 일 생성 헬퍼
   */
  async function createTodo(data: {
    startDate: Date;
    completed?: boolean;
    completedAt?: Date;
    categoryName?: string;
  }): Promise<void> {
    const prisma = testDb.getClient();

    // 카테고리 조회
    const category = decodeRecord(
      "TodoCategory",
      await prisma.orm.public.TodoCategory.where((row) =>
        and(row.userId.eq(testUserId), row.name.eq(varchar(data.categoryName ?? "업무", 50))),
      ).first(),
    );

    if (category === null) {
      throw new Error(`Category ${data.categoryName ?? "업무"} not found`);
    }

    decodeRecord(
      "Todo",
      await prisma.orm.public.Todo.create(
        encodeCreate("Todo", {
          userId: testUserId,
          categoryId: category.id,
          title: "테스트 할 일",
          startDate: data.startDate,
          completed: data.completed ?? false,
          completedAt: data.completedAt ?? null,
          isAllDay: true,
          visibility: "PUBLIC",
          sortOrder: 0,
        }),
      ),
    );
  }

  /**
   * 기본 집계 파라미터 생성 헬퍼
   */
  function createParams(overrides?: Partial<AggregateParams>): AggregateParams {
    return {
      userId: testUserId,
      // 2026-02-23 ~ 2026-03-02 (1주간)
      startDate: new Date("2026-02-23T00:00:00.000Z"),
      endDate: new Date("2026-03-02T00:00:00.000Z"),
      prevStartDate: new Date("2026-02-16T00:00:00.000Z"),
      prevEndDate: new Date("2026-02-23T00:00:00.000Z"),
      timezone: "UTC",
      ...overrides,
    };
  }

  describe("빈 데이터", () => {
    it("할 일이 없으면 hasActivity: false, 모든 통계 0을 반환해야 한다", async () => {
      // Given: 할 일이 없는 상태
      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 모든 통계가 0이고 hasActivity가 false
      expect(result.hasActivity).toBe(false);
      expect(result.totalTodos).toBe(0);
      expect(result.completedTodos).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.prevCompletionRate).toBeNull();
      expect(result.streakDays).toBe(0);
      expect(result.categoryBreakdown).toEqual([]);
      expect(result.timePatterns).toEqual([]);
    });

    it("빈 데이터에서도 dayPatterns은 7개 요일을 반환해야 한다", async () => {
      // Given: 할 일이 없는 상태
      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 7개 요일이 모두 포함
      expect(result.dayPatterns).toHaveLength(7);
      const days = result.dayPatterns.map((p) => p.day);
      expect(days).toContain("MON");
      expect(days).toContain("SUN");
    });
  });

  describe("정상 데이터 집계", () => {
    it("전체/완료 할 일 수와 달성률을 정확하게 계산해야 한다", async () => {
      // Given: 3개 할 일 중 2개 완료
      await createTodo({
        startDate: new Date("2026-02-24T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-24T05:00:00.000Z"),
      });
      await createTodo({
        startDate: new Date("2026-02-25T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-25T10:00:00.000Z"),
      });
      await createTodo({
        startDate: new Date("2026-02-26T00:00:00.000Z"),
        completed: false,
      });

      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 3개 중 2개 완료, 달성률 67%
      expect(result.totalTodos).toBe(3);
      expect(result.completedTodos).toBe(2);
      expect(result.completionRate).toBe(67);
      expect(result.hasActivity).toBe(true);
    });

    it("카테고리별 집계가 정확해야 한다", async () => {
      // Given: 업무 2개, 개인 1개
      await createTodo({
        startDate: new Date("2026-02-24T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-24T05:00:00.000Z"),
        categoryName: "업무",
      });
      await createTodo({
        startDate: new Date("2026-02-25T00:00:00.000Z"),
        completed: false,
        categoryName: "업무",
      });
      await createTodo({
        startDate: new Date("2026-02-26T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-26T10:00:00.000Z"),
        categoryName: "개인",
      });

      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 카테고리별 집계가 정확
      expect(result.categoryBreakdown).toHaveLength(2);

      const work = result.categoryBreakdown.find((c) => c.name === "업무");
      expect(work).toBeDefined();
      expect(work?.total).toBe(2);
      expect(work?.completed).toBe(1);
      expect(work?.rate).toBe(50);

      const personal = result.categoryBreakdown.find((c) => c.name === "개인");
      expect(personal).toBeDefined();
      expect(personal?.total).toBe(1);
      expect(personal?.completed).toBe(1);
      expect(personal?.rate).toBe(100);
    });

    it("시간대별 패턴이 completedAt 기반으로 계산되어야 한다", async () => {
      // Given: 같은 시간대에 2개 완료
      await createTodo({
        startDate: new Date("2026-02-24T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-24T10:30:00.000Z"),
      });
      await createTodo({
        startDate: new Date("2026-02-25T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-25T10:45:00.000Z"),
      });

      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 10시에 2개 완료 패턴
      expect(result.timePatterns.length).toBeGreaterThan(0);
      const hourTen = result.timePatterns.find((p) => p.hour === 10);
      expect(hourTen).toBeDefined();
      expect(hourTen?.count).toBe(2);
    });

    it("이전 기간 달성률을 정확하게 계산해야 한다", async () => {
      // Given: 이전 기간에 2개 중 1개 완료
      await createTodo({
        startDate: new Date("2026-02-17T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-17T10:00:00.000Z"),
      });
      await createTodo({
        startDate: new Date("2026-02-18T00:00:00.000Z"),
        completed: false,
      });

      // 현재 기간에 1개 완료
      await createTodo({
        startDate: new Date("2026-02-24T00:00:00.000Z"),
        completed: true,
        completedAt: new Date("2026-02-24T10:00:00.000Z"),
      });

      const params = createParams();

      // When: aggregate를 호출하면
      const result = await aggregate(params);

      // Then: 이전 기간 달성률 50%
      expect(result.prevCompletionRate).toBe(50);
      expect(result.completionRate).toBe(100);
    });
  });
  it("활성 UoW의 미커밋 쓰기를 읽고 롤백 후 Prisma 8 조회에 노출하지 않는다", async () => {
    const params = createParams();
    const category = decodeRecord(
      "TodoCategory",
      requireRecord(
        await prismaClient.orm.public.TodoCategory.where((row) =>
          row.userId.eq(testUserId),
        ).first(),
      ),
    );
    await expect(
      uow.run(async () => {
        await txHost.tx.orm.public.Todo.create(
          encodeCreate("Todo", {
            userId: testUserId,
            categoryId: category.id,
            title: "미커밋 할 일",
            startDate: params.startDate,
            completed: true,
            completedAt: new Date("2026-02-23T23:30:00.000Z"),
          }),
        );
        const inputs = await reader.fetchAggregationInputs(params);
        expect(
          assembleAggregatedData(inputs, params.startDate, params.endDate, params.timezone)
            .totalTodos,
        ).toBe(1);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await aggregate(params)).totalTodos).toBe(0);
  });

  it("UTC DATE 경계와 null 완료 시각을 유지하고 다른 사용자의 데이터를 제외한다", async () => {
    const params = createParams({ timezone: "Asia/Seoul" });
    await createTodo({ startDate: params.startDate, completed: true });
    await createTodo({
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      completed: true,
      completedAt: new Date("2026-03-01T23:30:00.000Z"),
    });
    await createTodo({ startDate: params.endDate, completed: true, completedAt: params.endDate });
    const otherUser = decodeRecord(
      "User",
      await prismaClient.orm.public.User.create(
        encodeCreate("User", {
          email: "other-aggregator@example.com",
          userTag: "OTHER001",
          status: "ACTIVE",
        }),
      ),
    );
    const otherCategory = decodeRecord(
      "TodoCategory",
      await prismaClient.orm.public.TodoCategory.create(
        encodeCreate("TodoCategory", {
          userId: otherUser.id,
          name: "다른 사용자",
          color: "#FF0000",
          sortOrder: 0,
        }),
      ),
    );
    decodeRecord(
      "Todo",
      await prismaClient.orm.public.Todo.create(
        encodeCreate("Todo", {
          userId: otherUser.id,
          categoryId: otherCategory.id,
          title: "다른 사용자의 할 일",
          startDate: params.startDate,
          completed: true,
          completedAt: params.startDate,
        }),
      ),
    );
    const result = await aggregate(params);
    expect(result.totalTodos).toBe(2);
    expect(result.completedTodos).toBe(2);
    expect(result.timePatterns).toEqual([{ hour: 8, count: 1 }]);
  });
});

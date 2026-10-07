import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { EntitlementCacheAdapter } from "#api/modules/access/infrastructure/adapters/entitlement/entitlement-cache.adapter";
import { PrismaEntitlementReader } from "#api/modules/access/infrastructure/persistence/entitlement/prisma-entitlement.reader";
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { CreateSuggestionInput } from "#api/modules/ai-assistance/application/ports/suggestions/ai-suggestion.repository.port";
import type { RecurringTodoCreatorPort } from "#api/modules/ai-assistance/application/ports/suggestions/recurring-todo-creator.port";
import { SuggestionContextBuilder } from "#api/modules/ai-assistance/application/services/suggestions/suggestion-context.builder";
import { GenerateReport } from "#api/modules/ai-assistance/application/use-cases/reports/generate-report.use-case";
import { AnalyzeAndCreateSuggestions } from "#api/modules/ai-assistance/application/use-cases/suggestions/analyze-and-create-suggestions.use-case";
import { HandleSuggestionAction } from "#api/modules/ai-assistance/application/use-cases/suggestions/handle-suggestion-action.use-case";
import { AiReportJobName } from "#api/modules/ai-assistance/infrastructure/jobs/reports/ai-report-queue";
import { AiSuggestionJobName } from "#api/modules/ai-assistance/infrastructure/jobs/suggestions/ai-suggestion-queue";
import { PrismaAiReportRepository } from "#api/modules/ai-assistance/infrastructure/persistence/reports/prisma-ai-report.repository";
import { PrismaTodoStatsReader } from "#api/modules/ai-assistance/infrastructure/persistence/reports/prisma-todo-stats.reader";
import { PrismaAiSuggestionRepository } from "#api/modules/ai-assistance/infrastructure/persistence/suggestions/prisma-ai-suggestion.repository";
import { ReportGenerationProcessor } from "#api/modules/ai-assistance/infrastructure/processors/reports/report-generation.processor";
import { SuggestionAnalysisProcessor } from "#api/modules/ai-assistance/infrastructure/processors/suggestions/suggestion-analysis.processor";
import { UserRepository } from "#api/modules/identity/infrastructure/persistence/auth/user.repository";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { createEntityId, varchar } from "#api/platform/database/database-values";
import type { User } from "#api/platform/database/database.types";
import { databaseSqlState } from "#api/platform/database/prisma-error.util";
import { createDetectedPattern, createReportAiResponse } from "#test/fixtures/ai-response.fixture";
import { TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { FakeAiProvider } from "#test/mocks/fake-ai.provider";
import {
  createDatabaseTransactionFixture,
  createTestClient,
  createTestDatabaseService,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const CURRENT_TIME = new Date("2026-10-08T02:00:00Z");

class GatedAiProvider extends FakeAiProvider {
  readonly entered = Promise.withResolvers<void>();
  readonly released = Promise.withResolvers<void>();

  override async generateStructured<T>(
    input: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const result = await super.generateStructured(input);
    this.entered.resolve();
    await this.released.promise;
    return result;
  }
}

class FailingSuggestionRepository extends PrismaAiSuggestionRepository {
  override createMany(inputs: CreateSuggestionInput[]) {
    return super.createMany(inputs.map((input) => ({ ...input, userId: "missing-ai-user" })));
  }
}

describe("AI 유료 실행·저장·수락 정합성 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
  let client: TestDatabaseClient;
  let fixture: ReturnType<typeof createDatabaseTransactionFixture>;
  let memory: InMemoryCacheAdapter;
  let entitlement: EntitlementService;
  let suggestions: PrismaAiSuggestionRepository;
  let reports: PrismaAiReportRepository;
  let users: UserRepository;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(CURRENT_TIME);
    fixture = createDatabaseTransactionFixture(client);
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 600_000, maxItems: 20 });
    entitlement = new EntitlementService({
      database: new PrismaEntitlementReader(fixture.txHost),
      cacheService: new EntitlementCacheAdapter(new CacheService(memory)),
    });
    suggestions = new PrismaAiSuggestionRepository(fixture.txHost);
    reports = new PrismaAiReportRepository(fixture.txHost);
    users = new UserRepository(fixture.txHost);
    userId = createEntityId();
    await client.orm.public.User.create(
      encodeCreate("User", UserFixture.create({ id: userId, subscriptionStatus: "ACTIVE" })),
    );
    const category = decodeRecord(
      "TodoCategory",
      await client.orm.public.TodoCategory.create(
        encodeCreate("TodoCategory", { userId, name: "독서", color: "#3B82F6", sortOrder: 0 }),
      ),
    );
    categoryId = category.id;
    await client.orm.public.Todo.createAndCount(
      ["2026-10-01", "2026-10-02", "2026-10-03"].map((date) => {
        const { id: _id, ...row } = TodoFixture.create({
          userId,
          categoryId,
          title: "책 읽기 10분",
          startDate: new Date(`${date}T00:00:00Z`),
        });
        return encodeCreate("Todo", row);
      }),
    );
  });
  afterEach(() => {
    memory?.onModuleDestroy();
    vi.useRealTimers();
  });
  afterAll(async () => {
    await database.stop();
  });

  const userMutationLock = {
    async lockById(id: string) {
      return (await users.findByIdForUpdate(id)) !== null;
    },
  };

  function generation(provider: FakeAiProvider, repository = suggestions) {
    const logger = new Logger("AiGenerationIntegration");
    const service = createTestDatabaseService(client);
    const contextBuilder = new SuggestionContextBuilder({
      repository,
      weatherForecastReader: { getForecastsByGridBatch: async () => new Map() },
      reportReader: { findLatestWeekly: async () => null },
      logger,
    });
    const analyze = new AnalyzeAndCreateSuggestions({
      repository,
      aiProvider: provider,
      contextBuilder,
      entitlementReader: entitlement,
      unitOfWork: fixture.uow,
      userMutationLock,
      logger,
    });
    const report = new GenerateReport({
      aiReportRepository: reports,
      todoStatsReader: new PrismaTodoStatsReader(fixture.txHost, service),
      aiProvider: provider,
      entitlementReader: entitlement,
      unitOfWork: fixture.uow,
      userMutationLock,
      logger,
    });
    const notifications: { userId: string }[] = [];
    const reportProcessor = new ReportGenerationProcessor(report);
    const suggestionProcessor = new SuggestionAnalysisProcessor(
      analyze,
      {
        publish: async (notification) => {
          notifications.push(notification);
          return null;
        },
      },
      service,
    );
    return { analyze, report, reportProcessor, suggestionProcessor, notifications };
  }

  async function executeWorker(kind: "report" | "suggestion", provider: FakeAiProvider) {
    const flow = generation(provider);
    if (kind === "report") {
      provider.setRawResponse(createReportAiResponse());
      await flow.reportProcessor.process({
        name: AiReportJobName.GENERATE,
        data: { userId, timezone: "Asia/Seoul", reportType: "WEEKLY", locale: "ko" },
      });
    } else {
      provider.setRawResponse({ patterns: [createDetectedPattern()] });
      await flow.suggestionProcessor.process({
        name: AiSuggestionJobName.ANALYZE,
        data: { userId, timezone: "Asia/Seoul", weatherGrid: null },
      });
    }
    return flow;
  }

  async function patchUser(patch: Partial<User>) {
    await client.orm.public.User.where({ id: userId }).update(encodePatch("User", patch));
  }

  it("LA 분석의 DATE 월요일 완료율은 일요일로 이동하지 않는다", async () => {
    // Given
    await client.orm.public.DailyCompletion.create(
      encodeCreate("DailyCompletion", {
        id: createEntityId(),
        userId,
        date: new Date("2026-10-05T00:00:00Z"),
        totalTodos: 2,
        completedTodos: 2,
        achievedAt: new Date("2026-10-05T12:00:00Z"),
      }),
    );
    // When
    const rates = await suggestions.findDayCompletionRates(
      userId,
      new Date("2026-10-01T00:00:00Z"),
      CURRENT_TIME,
      "America/Los_Angeles",
    );
    // Then
    expect(rates.find((rate) => rate.day === "MON")).toMatchObject({ total: 2, completed: 2 });
    expect(rates.find((rate) => rate.day === "SUN")).toMatchObject({ total: 0, completed: 0 });
  });

  it.each([
    {
      timezone: "Asia/Seoul",
      from: "2026-10-07T15:00:00Z",
      to: "2026-10-07T15:30:00Z",
      dates: ["2026-10-07", "2026-10-08", "2026-10-09"],
    },
    {
      timezone: "America/Los_Angeles",
      from: "2026-10-07T07:00:00Z",
      to: "2026-10-08T00:30:00Z",
      dates: ["2026-10-06", "2026-10-07", "2026-10-08"],
    },
  ])(
    "$timezone 추천의 DATE 조회 범위는 UTC 날짜 대신 사용자 현지 날짜를 포함한다",
    async ({ timezone, from, to, dates }) => {
      // Given
      await client.orm.public.Todo.where({ userId }).deleteAndCount();
      await client.orm.public.Todo.createAndCount(
        dates.map((date) => {
          const { id: _id, ...row } = TodoFixture.create({
            userId,
            categoryId,
            title: date,
            startDate: new Date(`${date}T00:00:00Z`),
            completed: true,
            completedAt: new Date(`${date}T12:00:00Z`),
          });
          return encodeCreate("Todo", row);
        }),
      );
      await client.orm.public.DailyCompletion.createAndCount(
        dates.map((date) =>
          encodeCreate("DailyCompletion", {
            id: createEntityId(),
            userId,
            date: new Date(`${date}T00:00:00Z`),
            totalTodos: 1,
            completedTodos: 1,
            achievedAt: new Date(`${date}T12:00:00Z`),
          }),
        ),
      );
      // When
      const start = new Date(from);
      const end = new Date(to);
      const [todos, days, times, categories] = await Promise.all([
        suggestions.findRecentTodos(userId, start, end, timezone),
        suggestions.findDayCompletionRates(userId, start, end, timezone),
        suggestions.findTimeCompletionRates(userId, start, end, timezone),
        suggestions.findCategoryCompletionRates(userId, start, end, timezone),
      ]);
      // Then
      expect(todos.map((todo) => todo.title)).toEqual([dates[1]]);
      expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(1);
      expect(times.morning.count + times.afternoon.count).toBe(1);
      expect(categories).toMatchObject([{ total: 1, completed: 1 }]);
    },
  );

  async function counts() {
    const [report, suggestion] = await Promise.all([
      client.orm.public.AiReport.where({ userId }).aggregate((a) => ({ count: a.count() })),
      client.orm.public.RecurringSuggestion.where({ userId }).aggregate((a) => ({
        count: a.count(),
      })),
    ]);
    return { reports: report.count, suggestions: suggestion.count };
  }

  it.each(["report", "suggestion"] as const)(
    "유효 ACTIVE 사용자에게 %s worker가 결과를 한 번 저장한다",
    async (kind) => {
      // Given
      const provider = new FakeAiProvider();
      // When
      const flow = await executeWorker(kind, provider);
      // Then
      expect(provider.getCallCount()).toBe(1);
      expect(await counts()).toEqual(
        kind === "report" ? { reports: 1, suggestions: 0 } : { reports: 0, suggestions: 1 },
      );
      expect(flow.notifications).toHaveLength(kind === "suggestion" ? 1 : 0);
    },
  );

  it.each(["Asia/Seoul", "America/Los_Angeles"])(
    "%s 보고서는 저장된 DATE의 월요일·마지막 일요일을 해당 기간에 포함한다",
    async (timezone) => {
      // Given
      await client.orm.public.Todo.createAndCount(
        [
          { date: "2026-09-27", completed: false },
          { date: "2026-09-28", completed: true },
          { date: "2026-10-04", completed: true },
        ].map(({ date, completed }) => {
          const { id: _id, ...row } = TodoFixture.create({
            userId,
            categoryId,
            title: "주간 날짜 경계",
            startDate: new Date(`${date}T00:00:00Z`),
            completed,
            completedAt: completed ? new Date(`${date}T12:00:00Z`) : null,
          });
          return encodeCreate("Todo", row);
        }),
      );
      const provider = new FakeAiProvider();
      provider.setRawResponse(createReportAiResponse());
      // When
      const report = await generation(provider).report.execute({
        userId,
        timezone,
        type: "WEEKLY",
      });
      // Then
      expect(report?.stats).toMatchObject({ totalTodos: 5, completedTodos: 2, completionRate: 40 });
      expect(report?.dayPatterns.find((day) => day.day === "MON")?.total).toBe(1);
      expect(report?.dayPatterns.find((day) => day.day === "WED")?.total).toBe(0);
      expect(report?.dayPatterns.find((day) => day.day === "SUN")?.total).toBe(1);
    },
  );

  it.each([
    { subscriptionStatus: "FREE" },
    { subscriptionStatus: "EXPIRED" },
    { subscriptionStatus: "ACTIVE", status: "SUSPENDED", deletedAt: CURRENT_TIME },
    { role: "ADMIN", status: "SUSPENDED", deletedAt: CURRENT_TIME },
  ] satisfies Partial<User>[])(
    "구독 캐시가 ACTIVE여도 현재 $subscriptionStatus/$status 사용자의 worker는 실행하지 않는다",
    async (patch) => {
      // Given
      expect(await entitlement.hasPremiumAccess(userId)).toBe(true);
      await patchUser(patch);
      expect(await entitlement.hasPremiumAccess(userId)).toBe(true);
      // When
      for (const kind of ["report", "suggestion"] as const) {
        const provider = new FakeAiProvider();
        const flow = await executeWorker(kind, provider);
        // Then
        expect(provider.getCallCount()).toBe(0);
        expect(flow.notifications).toHaveLength(0);
      }
      expect(await counts()).toEqual({ reports: 0, suggestions: 0 });
    },
  );

  it.each(["report", "suggestion"] as const)(
    "%s AI 응답 대기 중 FREE로 바뀌면 결과·알림을 저장하지 않는다",
    async (kind) => {
      // Given
      const provider = new GatedAiProvider();
      const work = executeWorker(kind, provider);
      await Promise.race([
        provider.entered.promise,
        work.then(() => {
          throw new Error("AI 진입 전 종료");
        }),
      ]);
      // When
      try {
        await patchUser({ subscriptionStatus: "FREE" });
      } finally {
        provider.released.resolve();
      }
      const flow = await work;
      // Then
      expect(provider.getCallCount()).toBe(1);
      expect(await counts()).toEqual({ reports: 0, suggestions: 0 });
      expect(flow.notifications).toHaveLength(0);
    },
  );

  it("제안 교체 INSERT가 FK 실패하면 이전 PENDING·만료 행이 rollback된다", async () => {
    // Given
    await suggestions.createMany([
      {
        userId,
        title: "이전 제안",
        daysOfWeek: ["MON"],
        scheduledTime: null,
        confidence: 0.8,
        reason: "이전 기록",
        matchedTodos: [],
        expiresAt: new Date("2026-10-22T00:00:00Z"),
        suggestedCategoryId: categoryId,
      },
      {
        userId,
        title: "만료 제안",
        daysOfWeek: ["TUE"],
        scheduledTime: null,
        confidence: 0.8,
        reason: "이전 기록",
        matchedTodos: [],
        expiresAt: new Date("2026-10-01T00:00:00Z"),
        suggestedCategoryId: categoryId,
      },
    ]);
    const before = await client.orm.public.RecurringSuggestion.where({ userId })
      .orderBy((row) => row.id.asc())
      .all();
    const provider = new FakeAiProvider();
    provider.setRawResponse({ patterns: [createDetectedPattern()] });
    const flow = generation(provider, new FailingSuggestionRepository(fixture.txHost));
    // When
    const error = await flow.analyze
      .execute(userId, "Asia/Seoul", null)
      .catch((failure: unknown) => failure);
    // Then
    expect(databaseSqlState(error)).toBe("23503");
    expect(
      await client.orm.public.RecurringSuggestion.where({ userId })
        .orderBy((row) => row.id.asc())
        .all(),
    ).toEqual(before);
  });

  async function waitForLocks(count: number) {
    await vi.waitFor(
      async () => {
        const rows = await client
          .runtime()
          .query(
            client.raw
              .sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`
              .returnsRow({ count: "pg/int4@1" })
              .build(),
          );
        expect(rows[0]?.count).toBe(count);
      },
      { timeout: 5000, interval: 10 },
    );
  }

  it("유료 해제 transaction이 사용자 잠금을 잡고 있으면 저장은 commit 뒤 새 권한을 읽는다", async () => {
    // Given
    const provider = new FakeAiProvider();
    provider.setRawResponse({ patterns: [createDetectedPattern()] });
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const changing = withDatabaseTransaction(client, async (tx) => {
      await tx.orm.public.User.where({ id: userId }).update(
        encodePatch("User", { subscriptionStatus: "FREE" }),
      );
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      changing.then(() => {
        throw new Error("잠금 조기 종료");
      }),
    ]);
    // When
    const analysis = generation(provider).analyze.execute(userId, "Asia/Seoul", null);
    try {
      await waitForLocks(1);
    } finally {
      released.resolve();
      await changing;
      await analysis;
    }
    // Then
    expect(await analysis).toBe(0);
    expect(provider.getCallCount()).toBe(1);
    expect(await counts()).toEqual({ reports: 0, suggestions: 0 });
  });

  async function seedSuggestion() {
    await suggestions.createMany([
      {
        userId,
        title: "독서 5분",
        daysOfWeek: ["MON"],
        scheduledTime: null,
        confidence: 0.8,
        reason: "독서 기록 기반 제안",
        matchedTodos: ["독서"],
        suggestedCategoryId: categoryId,
        expiresAt: new Date("2026-10-22T00:00:00Z"),
      },
    ]);
    const row = await client.orm.public.RecurringSuggestion.where({ userId }).select("id").first();
    if (row === null) throw new Error("제안 fixture 생성 실패");
    return row.id;
  }

  function action(creator: RecurringTodoCreatorPort) {
    return new HandleSuggestionAction({
      repository: suggestions,
      recurringTodoCreator: creator,
      entitlementReader: entitlement,
      logger: new Logger("AiActionIntegration"),
      unitOfWork: fixture.uow,
      userMutationLock,
    });
  }

  const creator: RecurringTodoCreatorPort = {
    async createRecurring(input) {
      const { id: _id, ...row } = TodoFixture.create({
        userId: input.userId,
        categoryId: input.categoryId,
        title: input.title,
        startDate: new Date("2026-10-12T00:00:00Z"),
      });
      await fixture.txHost.tx.orm.public.Todo.create(encodeCreate("Todo", row));
      return { count: 1 };
    },
  };

  it("동시 수락 두 요청이 실제 잠금에서 대기해도 한 요청만 성공하고 Todo 한 개다", async () => {
    // Given
    const suggestionId = await seedSuggestion();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (tx) => {
      await tx.query(
        tx.raw.sql`SELECT "id" FROM "RecurringSuggestion" WHERE "id"=${suggestionId} FOR UPDATE`
          .returnsRow({ id: "pg/int4@1" })
          .build(),
      );
      entered.resolve();
      await released.promise;
    });
    await Promise.race([
      entered.promise,
      holding.then(() => {
        throw new Error("잠금 조기 종료");
      }),
    ]);
    // When
    const useCase = action(creator);
    const outcomes = Promise.allSettled(
      [1, 2].map(() =>
        useCase.execute({
          userId,
          suggestionId,
          action: "accept",
          categoryId,
          timezone: "Asia/Seoul",
          startDate: "2026-10-12",
          endDate: "2026-10-12",
        }),
      ),
    );
    try {
      await waitForLocks(2);
    } finally {
      released.resolve();
      await holding;
      await outcomes;
    }
    // Then
    const result = await outcomes;
    expect(result.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(result.find((outcome) => outcome.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: { errorCode: ErrorCode.AI_1306 },
    });
    expect(
      await client.orm.public.Todo.where({ userId, title: varchar("독서 5분", 200) }).aggregate(
        (a) => ({
          count: a.count(),
        }),
      ),
    ).toEqual({ count: 1 });
    expect((await suggestions.findByIdAndUserId(suggestionId, userId))?.status).toBe("ACCEPTED");
  });

  it("수락 생성이 Todo INSERT 뒤 실패하면 상태와 Todo를 함께 rollback하고 다시 수락할 수 있다", async () => {
    // Given
    const suggestionId = await seedSuggestion();
    const failure = new Error("recurring creation interrupted");
    const input = {
      userId,
      suggestionId,
      action: "accept" as const,
      categoryId,
      timezone: "Asia/Seoul",
    };
    // When
    await expect(
      action({
        async createRecurring(...args) {
          await creator.createRecurring(...args);
          throw failure;
        },
      }).execute(input),
    ).rejects.toBe(failure);
    // Then
    expect((await suggestions.findByIdAndUserId(suggestionId, userId))?.status).toBe("PENDING");
    expect(
      await client.orm.public.Todo.where({ userId, title: varchar("독서 5분", 200) }).aggregate(
        (a) => ({
          count: a.count(),
        }),
      ),
    ).toEqual({ count: 0 });
    await expect(action(creator).execute(input)).resolves.toMatchObject({ createdTodosCount: 1 });
    expect((await suggestions.findByIdAndUserId(suggestionId, userId))?.status).toBe("ACCEPTED");
  });
});

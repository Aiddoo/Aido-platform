import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { GetResolvedAccessUseCase } from "#api/modules/access/entitlements/application/use-cases/get-resolved-access.use-case";
import { EntitlementCacheAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-cache.adapter";
import { EntitlementReaderAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-reader.adapter";
import { DrizzleAccessStateReader } from "#api/modules/access/entitlements/infrastructure/persistence/drizzle-access-state.reader";
import type {
  AiGenerationRequest,
  AiGenerationResult,
} from "#api/modules/ai-assistance/application/ports/generation/ai-generator.port";
import type { CreateSuggestionInput } from "#api/modules/ai-assistance/application/ports/suggestions/ai-suggestion.repository.port";
import type { SuggestionTodoCreatorPort } from "#api/modules/ai-assistance/application/ports/suggestions/suggestion-todo-creator.port";
import { SuggestionContextBuilder } from "#api/modules/ai-assistance/application/services/suggestions/suggestion-context.builder";
import { GenerateReport } from "#api/modules/ai-assistance/application/use-cases/reports/generate-report.use-case";
import { AnalyzeAndCreateSuggestions } from "#api/modules/ai-assistance/application/use-cases/suggestions/analyze-and-create-suggestions.use-case";
import { HandleSuggestionAction } from "#api/modules/ai-assistance/application/use-cases/suggestions/handle-suggestion-action.use-case";
import { AiReportJobName } from "#api/modules/ai-assistance/infrastructure/jobs/reports/ai-report-queue";
import { AiSuggestionJobName } from "#api/modules/ai-assistance/infrastructure/jobs/suggestions/ai-suggestion-queue";
import { DrizzleAiReportRepository } from "#api/modules/ai-assistance/infrastructure/persistence/reports/drizzle-ai-report.repository";
import { DrizzleTodoStatsReader } from "#api/modules/ai-assistance/infrastructure/persistence/reports/drizzle-todo-stats.reader";
import { DrizzleAiSuggestionRepository } from "#api/modules/ai-assistance/infrastructure/persistence/suggestions/drizzle-ai-suggestion.repository";
import { ReportGenerationProcessor } from "#api/modules/ai-assistance/infrastructure/processors/reports/report-generation.processor";
import { SuggestionAnalysisProcessor } from "#api/modules/ai-assistance/infrastructure/processors/suggestions/suggestion-analysis.processor";
import { GetAiDataSharingConsentUseCase } from "#api/modules/identity/preferences/application/use-cases/get-ai-data-sharing-consent.use-case";
import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { DrizzleClientAppVersionReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-client-app-version.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { databaseSqlState, requireRecord } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  aiReport,
  dailyCompletion,
  recurringSuggestion,
  todo,
  todoCategory,
  user as userTable,
} from "#api/platform/database/schema/index";
import type { AfterCommitTask } from "#api/shared/application/ports/index";
import { TodoBuilder } from "#test/builders/todo.builder";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createSuggestionPick } from "#test/fixtures/ai-assistance.fixture";
import { createReportAiResponse } from "#test/fixtures/ai-response.fixture";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";
import { TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";
import type { User } from "#test/types/database-rows";

const CURRENT_TIME = new Date("2026-10-08T02:00:00Z");

class GatedAiGenerator extends FakeAiGenerator {
  readonly entered = Promise.withResolvers<void>();
  readonly released = Promise.withResolvers<void>();

  override async generate<T>(input: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const result = await super.generate(input);
    this.entered.resolve();
    await this.released.promise;
    return result;
  }
}

class FailingSuggestionRepository extends DrizzleAiSuggestionRepository {
  override createMany(inputs: CreateSuggestionInput[]) {
    return super.createMany(inputs.map((input) => ({ ...input, userId: "missing-ai-user" })));
  }
}

describe("AI 유료 실행·저장·수락 정합성 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
  let client: TestDatabaseClient;
  let fixture: ReturnType<typeof createDatabaseTransactionFixture>;
  let memory: InMemoryCacheStore;
  let entitlement: EntitlementReaderAdapter;
  let suggestions: DrizzleAiSuggestionRepository;
  let reports: DrizzleAiReportRepository;
  let users: DrizzleUserRepository;
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
    memory = new InMemoryCacheStore({ defaultTtlMs: 600_000, maxItems: 20 });
    entitlement = new EntitlementReaderAdapter(
      new GetResolvedAccessUseCase({
        accessStateReader: new DrizzleAccessStateReader(fixture.txHost),
        entitlementCache: new EntitlementCacheAdapter(new CacheService(memory)),
        clock: new DateClock(),
      }),
    );
    suggestions = new DrizzleAiSuggestionRepository(fixture.txHost);
    reports = new DrizzleAiReportRepository(fixture.txHost);
    users = new DrizzleUserRepository(fixture.txHost);
    userId = createEntityId();
    await client
      .insert(userTable)
      .values(UserFixture.create({ id: userId, subscriptionStatus: "ACTIVE" }));
    const [category] = await client
      .insert(todoCategory)
      .values({ userId, name: "독서", color: "#3B82F6", sortOrder: 0 })
      .returning();
    categoryId = requireRecord(category).id;
    await client.insert(todo).values(
      ["2026-10-01", "2026-10-02", "2026-10-03"].map((date) => {
        const { id: _id, ...row } = TodoFixture.create({
          userId,
          categoryId,
          title: "책 읽기 10분",
          startDate: new Date(`${date}T00:00:00Z`),
        });
        return row;
      }),
    );
  });
  afterEach(() => {
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

  function generation(provider: FakeAiGenerator, repository = suggestions) {
    const logger = new Logger("AiGenerationIntegration");
    const consentReader = new GetAiDataSharingConsentUseCase({
      consentRepository: new DrizzleUserConsentRepository(fixture.txHost),
    });
    const contextBuilder = new SuggestionContextBuilder({
      repository,
      weatherForecastReader: { getForecastsByGridBatch: async () => new Map() },
      reportReader: { findLatestWeekly: async () => null },
      logger,
    });
    const analyze = new AnalyzeAndCreateSuggestions({
      repository,
      generator: provider,
      aiDataSharingConsent: consentReader,
      clientAppVersion: new DrizzleClientAppVersionReader(fixture.txHost),
      contextBuilder,
      entitlementReader: entitlement,
      unitOfWork: fixture.uow,
      userMutationLock,
      logger,
    });
    const report = new GenerateReport({
      aiReportRepository: reports,
      todoStatsReader: new DrizzleTodoStatsReader(fixture.txHost),
      generator: provider,
      aiDataSharingConsent: consentReader,
      clientAppVersion: new DrizzleClientAppVersionReader(fixture.txHost),
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
      fixture.txHost,
    );
    return { analyze, report, reportProcessor, suggestionProcessor, notifications };
  }

  async function executeWorker(kind: "report" | "suggestion", provider: FakeAiGenerator) {
    const flow = generation(provider);
    if (kind === "report") {
      provider.setRawResponse(createReportAiResponse());
      await flow.reportProcessor.process({
        name: AiReportJobName.GENERATE,
        data: { userId, timezone: "Asia/Seoul", reportType: "WEEKLY", locale: "ko" },
      });
    } else {
      provider.setRawResponse({ picks: [createSuggestionPick()] });
      await flow.suggestionProcessor.process({
        name: AiSuggestionJobName.ANALYZE,
        data: { userId, timezone: "Asia/Seoul", weatherGrid: null },
      });
    }
    return flow;
  }

  async function patchUser(patch: Partial<User>) {
    await client.update(userTable).set(patch).where(eq(userTable.id, userId));
  }

  it("LA 분석의 DATE 월요일 완료율은 일요일로 이동하지 않는다", async () => {
    // Given
    await client.insert(dailyCompletion).values({
      id: createEntityId(),
      userId,
      date: new Date("2026-10-05T00:00:00Z"),
      totalTodos: 2,
      completedTodos: 2,
      achievedAt: new Date("2026-10-05T12:00:00Z"),
    });

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
      await client.delete(todo).where(eq(todo.userId, userId));
      await client.insert(todo).values(
        dates.map((date) => {
          const { id: _id, ...row } = TodoFixture.create({
            userId,
            categoryId,
            title: date,
            startDate: new Date(`${date}T00:00:00Z`),
            completed: true,
            completedAt: new Date(`${date}T12:00:00Z`),
          });
          return row;
        }),
      );
      await client.insert(dailyCompletion).values(
        dates.map((date) => ({
          id: createEntityId(),
          userId,
          date: new Date(`${date}T00:00:00Z`),
          totalTodos: 1,
          completedTodos: 1,
          achievedAt: new Date(`${date}T12:00:00Z`),
        })),
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
    const [reports, suggestions] = await Promise.all([
      client.$count(aiReport, eq(aiReport.userId, userId)),
      client.$count(recurringSuggestion, eq(recurringSuggestion.userId, userId)),
    ]);
    return { reports, suggestions };
  }

  it.each(["report", "suggestion"] as const)(
    "유효 ACTIVE 사용자에게 %s worker가 결과를 한 번 저장한다",
    async (kind) => {
      // Given
      const provider = new FakeAiGenerator();

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

  it.each([
    { kind: "report" as const, offsetMs: -1, expected: { reports: 1, suggestions: 0 } },
    { kind: "report" as const, offsetMs: 0, expected: { reports: 0, suggestions: 0 } },
    { kind: "suggestion" as const, offsetMs: -1, expected: { reports: 0, suggestions: 1 } },
    { kind: "suggestion" as const, offsetMs: 0, expected: { reports: 0, suggestions: 0 } },
  ])(
    "보상 기간만 있는 사용자의 $kind worker는 끝나는 시각 $offsetMs ms에 sweep 전이라도 끝 시각부터 저장하지 않는다",
    async ({ kind, offsetMs, expected }) => {
      // Given
      const grantEndsAt = new Date(CURRENT_TIME.getTime() + 60_000);
      await patchUser({ subscriptionStatus: "ACTIVE", subscriptionExpiresAt: grantEndsAt });
      vi.setSystemTime(new Date(grantEndsAt.getTime() + offsetMs));
      const provider = new FakeAiGenerator();

      // When
      await executeWorker(kind, provider);

      // Then
      expect(await counts()).toEqual(expected);
    },
  );

  it.each(["Asia/Seoul", "America/Los_Angeles"])(
    "%s 보고서는 저장된 DATE의 월요일·마지막 일요일을 해당 기간에 포함한다",
    async (timezone) => {
      // Given
      await client.insert(todo).values(
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
          return row;
        }),
      );
      const provider = new FakeAiGenerator();
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
      expect(await entitlement.can(userId, "AI_REPORT")).toBe(true);
      await patchUser(patch);
      expect(await entitlement.can(userId, "AI_REPORT")).toBe(true);

      // When
      for (const kind of ["report", "suggestion"] as const) {
        const provider = new FakeAiGenerator();
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
      const provider = new GatedAiGenerator();
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
    const before = await client.query.recurringSuggestion.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
    const provider = new FakeAiGenerator();
    provider.setRawResponse({ picks: [createSuggestionPick()] });
    const flow = generation(provider, new FailingSuggestionRepository(fixture.txHost));

    // When
    const error = await flow.analyze
      .execute(userId, "Asia/Seoul", null)
      .catch((failure: unknown) => failure);

    // Then
    expect(databaseSqlState(error)).toBe("23503");
    expect(
      await client.query.recurringSuggestion.findMany({
        where: { userId },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
  });

  async function waitForLocks(count: number) {
    await vi.waitFor(
      async () => {
        const waiting = await client.execute<{ count: number }>(
          sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`,
        );
        expect(waiting.rows[0]?.count).toBe(count);
      },
      { timeout: 5000, interval: 10 },
    );
  }

  it("유료 해제 transaction이 사용자 잠금을 잡고 있으면 저장은 commit 뒤 새 권한을 읽는다", async () => {
    // Given
    const provider = new FakeAiGenerator();
    provider.setRawResponse({ picks: [createSuggestionPick()] });
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const changing = client.transaction(async (tx) => {
      await tx
        .update(userTable)
        .set({ subscriptionStatus: "FREE" })
        .where(eq(userTable.id, userId));
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
    const row = await client.query.recurringSuggestion.findFirst({
      columns: { id: true },
      where: { userId },
    });
    if (row == null) {
      throw new Error("제안 fixture 생성 실패");
    }
    return row.id;
  }

  const registeredAfterCommit: AfterCommitTask[] = [];

  function action(todoCreator: SuggestionTodoCreatorPort) {
    return new HandleSuggestionAction({
      repository: suggestions,
      todoCreator,
      entitlementReader: entitlement,
      logger: new Logger("AiActionIntegration"),
      unitOfWork: fixture.uow,
      userMutationLock,
      mutationLock: { acquire: async () => undefined },
      afterCommit: { register: (task) => registeredAfterCommit.push(task) },
      localePreferenceReader: new StubUserLocalePreferenceReader(),
    });
  }

  const creator: SuggestionTodoCreatorPort = {
    async stage(input) {
      const { id: _id, ...row } = TodoFixture.create({
        userId: input.userId,
        categoryId: input.categoryId,
        title: input.title,
        startDate: new Date("2026-10-12T00:00:00Z"),
      });
      await fixture.txHost.tx.insert(todo).values(row);
      return {
        todos: [createTodoResponseFixture(TodoBuilder.create(input.userId).withId(1).build())],
        series: null,
        afterCommit: async () => undefined,
      };
    },
  };

  beforeEach(() => {
    registeredAfterCommit.length = 0;
  });

  it("동시 수락 두 요청이 실제 잠금에서 대기해도 한 요청만 성공하고 Todo 한 개다", async () => {
    // Given
    const suggestionId = await seedSuggestion();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = client.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT "id" FROM "RecurringSuggestion" WHERE "id"=${suggestionId} FOR UPDATE`,
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
      await client.$count(todo, and(eq(todo.userId, userId), eq(todo.title, "독서 5분"))),
    ).toBe(1);
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
        async stage(data) {
          await creator.stage(data);
          throw failure;
        },
      }).execute(input),
    ).rejects.toBe(failure);

    // Then
    expect((await suggestions.findByIdAndUserId(suggestionId, userId))?.status).toBe("PENDING");
    expect(
      await client.$count(todo, and(eq(todo.userId, userId), eq(todo.title, "독서 5분"))),
    ).toBe(0);
    expect(registeredAfterCommit).toEqual([]);
    await expect(action(creator).execute(input)).resolves.toMatchObject({ createdTodosCount: 1 });
    expect((await suggestions.findByIdAndUserId(suggestionId, userId))?.status).toBe("ACCEPTED");
    expect(registeredAfterCommit).toHaveLength(1);
  });
});

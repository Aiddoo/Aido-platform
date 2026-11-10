import {
  AI_REPORT_QUEUE,
  AiReportRuntimeJobSchema,
} from "#api/modules/ai-assistance/reports/infrastructure/jobs/ai-report.queue";
import { ReportGenerationProcessor } from "#api/modules/ai-assistance/reports/infrastructure/jobs/report-generation.processor";
import { ReportGenerationScheduler } from "#api/modules/ai-assistance/reports/infrastructure/jobs/report-generation.scheduler";
import {
  AI_SUGGESTION_QUEUE,
  AiSuggestionJobName,
} from "#api/modules/ai-assistance/suggestions/infrastructure/jobs/ai-suggestion.queue";
import { SuggestionAnalysisScheduler } from "#api/modules/ai-assistance/suggestions/infrastructure/jobs/suggestion-analysis.scheduler";
import { requireRecord } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { TodoFixture } from "#test/fixtures/todo.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 서울 2026-10-08(목) 07:00 = UTC 2026-10-07 22:00, LA 2026-10-08 07:00 PDT = UTC 2026-10-08 14:00
const SEOUL_0700 = Temporal.Instant.from("2026-10-07T22:00:00Z");

describe("AI 제안·리포트 디스패치 — 사용자 현지 시각 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let clock: FixedClock;
  let queue: InMemoryJobQueue;
  let scheduler: SuggestionAnalysisScheduler;
  let seoulUserId: string;
  let laUserId: string;

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    clock = new FixedClock(SEOUL_0700);
    queue = new InMemoryJobQueue();
    scheduler = new SuggestionAnalysisScheduler(
      createDatabaseTransactionFixture(client).txHost,
      queue,
      clock,
    );
    seoulUserId = await createActiveUser("Asia/Seoul");
    laUserId = await createActiveUser("America/Los_Angeles");
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(async () => {
    await database.stop();
  });

  async function createActiveUser(timezone: string): Promise<string> {
    const id = createEntityId();
    await client.insert(userTable).values(UserFixture.create({ id, subscriptionStatus: "ACTIVE" }));
    await client.insert(userPreference).values({ userId: id, timezone });
    await insertRecentTodo(id, "2026-10-05");
    return id;
  }

  async function insertRecentTodo(userId: string, date: string): Promise<void> {
    const [category] = await client
      .insert(todoCategory)
      .values({
        userId,
        name: "기록",
        color: "#3B82F6",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        sortOrder: 0,
      })
      .onConflictDoNothing()
      .returning();
    const categoryId =
      category?.id ??
      requireRecord(await client.query.todoCategory.findFirst({ where: { userId } })).id;
    const { id: _id, ...row } = TodoFixture.create({
      userId,
      categoryId,
      title: "최근 기록",
      startDate: Temporal.PlainDate.from(date),
    });
    await client.insert(todo).values(row);
  }

  function analyzeKeys(): (string | undefined)[] {
    return queue
      .jobsIn(AI_SUGGESTION_QUEUE)
      .filter((job) => "name" in job.payload && job.payload.name === AiSuggestionJobName.ANALYZE)
      .map((job) => job.options.idempotencyKey);
  }

  it("서울 07시에는 서울 사용자만, LA 07시에는 LA 사용자만 그 현지 날짜 키로 등록한다", async () => {
    // When - 서울 07:00(LA 전날 15:00)
    await scheduler.dispatchAnalysis();

    // Then
    expect(analyzeKeys()).toEqual([`suggestion_${seoulUserId}_2026-10-08`]);

    // When - LA 07:00 PDT(서울 23:00)
    clock.advanceBy({ hours: 16 });
    await scheduler.dispatchAnalysis();

    // Then
    expect(analyzeKeys()).toEqual([
      `suggestion_${seoulUserId}_2026-10-08`,
      `suggestion_${laUserId}_2026-10-08`,
    ]);
  });

  it("따라잡기 창(07~10시)의 매시 디스패치가 다시 돌아도 같은 현지 날짜에는 한 번만 등록한다", async () => {
    // When - 서울 07·08·09시와 창 밖 10시
    for (const _hour of [7, 8, 9, 10]) {
      await scheduler.dispatchAnalysis();
      clock.advanceBy({ hours: 1 });
    }

    // Then
    expect(analyzeKeys()).toEqual([`suggestion_${seoulUserId}_2026-10-08`]);

    // When - 다음 날 서울 07시
    clock.advanceBy({ hours: 20 });
    await scheduler.dispatchAnalysis();

    // Then
    expect(analyzeKeys()).toEqual([
      `suggestion_${seoulUserId}_2026-10-08`,
      `suggestion_${seoulUserId}_2026-10-09`,
    ]);
  });

  it("LA 서머타임이 끝난 날에도 현지 07시(PST)에 한 번 등록한다", async () => {
    // Given - LA 2026-11-01(일) 서머타임 종료, 07:00 PST = UTC 15:00
    clock = new FixedClock(Temporal.Instant.from("2026-11-01T14:00:00Z"));
    scheduler = new SuggestionAnalysisScheduler(
      createDatabaseTransactionFixture(client).txHost,
      queue,
      clock,
    );
    await insertRecentTodo(laUserId, "2026-10-30");

    // When - 06:00 PST, 07:00 PST
    await scheduler.dispatchAnalysis();
    const beforeLocalSeven = analyzeKeys();
    clock.advanceBy({ hours: 1 });
    await scheduler.dispatchAnalysis();

    // Then
    expect(beforeLocalSeven).toEqual([]);
    expect(analyzeKeys()).toEqual([`suggestion_${laUserId}_2026-11-01`]);
  });

  describe("리포트", () => {
    let runtime: FakeJobRuntime;

    function reportScheduler() {
      runtime = new FakeJobRuntime();
      return new ReportGenerationScheduler(
        createDatabaseTransactionFixture(client).txHost,
        runtime,
        new ReportGenerationProcessor({ execute: async () => null }),
        new DateClock(),
      );
    }

    function reportJobs(name: "generate-report" | "dispatch-reports" = "generate-report") {
      return runtime.enqueueCalls.flatMap((call) => {
        const job = AiReportRuntimeJobSchema.parse(call.data);
        return call.queue === AI_REPORT_QUEUE && job.name === name
          ? [{ key: call.options.idempotencyKey, data: job.data }]
          : [];
      });
    }

    it.each([
      {
        name: "서울 월요일 01:05(LA는 아직 일요일)에는 서울 사용자만",
        at: "2026-10-11T16:05:00Z",
        user: "seoul",
        week: "2026-W42",
      },
      {
        name: "LA 월요일 00:05(서울은 월요일 오후)에는 LA 사용자만 LA의 지난 주로",
        at: "2026-10-12T07:05:00Z",
        user: "la",
        week: "2026-W42",
      },
    ] as const)("주간 리포트는 $name 등록한다", async ({ at, user, week }) => {
      // Given
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(at) });
      const scheduler = reportScheduler();
      const userId = user === "seoul" ? seoulUserId : laUserId;

      // When
      await scheduler.dispatchReports("WEEKLY");

      // Then
      expect(reportJobs().map(({ key }) => key)).toEqual([`report_WEEKLY_${userId}_${week}`]);
    });

    it("시간대 설정이 없는 사용자는 기본 시간대(서울)·언어(ko)로 월간 창을 판단한다", async () => {
      // Given - 서울 11월 1일 00:05
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-31T15:05:00Z") });
      const userId = createEntityId();
      await client
        .insert(userTable)
        .values(UserFixture.create({ id: userId, subscriptionStatus: "ACTIVE" }));
      const scheduler = reportScheduler();

      // When
      await scheduler.dispatchReports("MONTHLY");

      // Then
      expect(reportJobs()).toContainEqual({
        key: `report_MONTHLY_${userId}_2026-M11`,
        data: { userId, timezone: "Asia/Seoul", locale: "ko", reportType: "MONTHLY" },
      });
    });

    it("재시작하면 놓친 매시 디스패치를 UTC 시각 멱등 키로 한 번만 보정한다", async () => {
      // Given
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T07:40:00Z") });
      const scheduler = reportScheduler();

      // When - 같은 시각에 두 번 부팅
      scheduler.onModuleInit();
      await scheduler.schedulerRegistration;
      scheduler.onModuleInit();
      await scheduler.schedulerRegistration;

      // Then
      expect(reportJobs("dispatch-reports").map(({ key }) => key)).toEqual([
        "dispatch_WEEKLY_2026-10-26T07",
        "dispatch_MONTHLY_2026-10-26T07",
      ]);
    });
  });
});

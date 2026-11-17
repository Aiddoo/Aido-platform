import { sql } from "drizzle-orm";

import { SuggestionLockKeys } from "#api/modules/ai-assistance/suggestions/application/suggestions.lock-keys";
import { RequestSuggestionAnalysisUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/request-suggestion-analysis.use-case";
import { DrizzleSuggestionAnalysisRunRepository } from "#api/modules/ai-assistance/suggestions/infrastructure/persistence/drizzle-suggestion-analysis-run.repository";
import { DrizzleSuggestionRepository } from "#api/modules/ai-assistance/suggestions/infrastructure/persistence/drizzle-suggestion.repository";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { RecordingSuggestionAnalysisEnqueuer } from "#test/doubles/ai-assistance/recording-suggestion-analysis-enqueuer";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SUGGESTION_FIXTURE_USER_ID } from "#test/fixtures/ai-assistance/suggestion.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 서울 2026-11-16 10:00
const NOW = Temporal.Instant.from("2026-11-16T01:00:00Z");
const USER_ID = UserId.reconstitute(SUGGESTION_FIXTURE_USER_ID);

describe("RequestSuggestionAnalysisUseCase (실제 PostgreSQL 잠금)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values(UserFixture.create({ id: SUGGESTION_FIXTURE_USER_ID }));
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRequest() {
    const { transactionHost, uow } = createDatabaseTransactionFixture(client);
    const enqueuer = new RecordingSuggestionAnalysisEnqueuer();
    const logger = createSpyApplicationLogger();
    const request = new RequestSuggestionAnalysisUseCase({
      entitlementReader: { can: async () => true },
      onDemandConfig: { isEnabled: true },
      runs: new DrizzleSuggestionAnalysisRunRepository(transactionHost),
      suggestions: new DrizzleSuggestionRepository(transactionHost),
      enqueuer,
      analysisState: {
        readRecentTodoCount: async () => ({ timeZone: "Asia/Seoul", recentTodoCount: 3 }),
        read: async () => ({ state: "ANALYZING", canRequestNow: false, nextAnalysisAt: NOW }),
      },
      unitOfWork: uow,
      mutationLock: new PostgresMutationLockAdapter(transactionHost),
      clock: new FixedClock(NOW),
      logger,
    });
    return { request, enqueuer, logger };
  }

  async function waitForLockWaiters(count: number) {
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

  it("두 기기가 동시에 요청해도 실행 기록은 한 번만 바뀌고 job은 1개다", async () => {
    // Given
    const { request, enqueuer, logger } = createRequest();
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    // 두 요청이 모두 같은 잠금 앞에서 기다리게 먼저 잡아 둔다
    const holder = client.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${SuggestionLockKeys.analysisRun(USER_ID)}, 0))`,
      );
      acquired.resolve();
      await released.promise;
    });
    await acquired.promise;

    // When
    const requests = Promise.all([
      request.execute({ userId: USER_ID.value }),
      request.execute({ userId: USER_ID.value }),
    ]);
    try {
      await waitForLockWaiters(2);
    } finally {
      released.resolve();
      await holder;
    }
    await requests;

    // Then
    expect(enqueuer.jobs).toHaveLength(1);
    expect(enqueuer.jobs[0]).toMatchObject({
      trigger: "ON_DEMAND",
      localDate: Temporal.PlainDate.from("2026-11-16"),
    });
    const runs = await client.query.suggestionAnalysisRun.findMany({
      where: { userId: USER_ID.value },
    });
    expect(runs).toEqual([
      expect.objectContaining({
        status: "QUEUED",
        trigger: "ON_DEMAND",
        localDate: Temporal.PlainDate.from("2026-11-16"),
      }),
    ]);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.suggestion-analysis.requested" }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.suggestion-analysis.deduplicated" }),
    );
  });
});

import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { UserBuilder } from "#test/builders/index";
import { databaseFixture, nativeRows } from "#test/mocks/database.mock";
import { asMock } from "#test/mocks/index";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { SuggestionAnalysisProcessor } from "../../processors/suggestions/suggestion-analysis.processor.js";
import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service.js";
import { AI_SUGGESTION_QUEUE } from "./ai-suggestion-queue.js";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job.js";

describe("SuggestionAnalysisJob — 영속 추천 분석 job 발행", () => {
  let job: SuggestionAnalysisJob;
  let database: ReturnType<typeof createMockDatabaseService>;
  let runtime: Mocked<JobRuntimePort>;
  let processor: Mocked<SuggestionAnalysisProcessor>;

  beforeEach(async () => {
    database = createMockDatabaseService();
    runtime = mock<JobRuntimePort>();
    runtime.schedule.mockResolvedValue(undefined);
    runtime.enqueue.mockResolvedValue("job-1");
    processor = mock<SuggestionAnalysisProcessor>();
    const maintenance = mock<AiSuggestionQueueMaintenanceService>();
    maintenance.cleanExpiredFailures.mockResolvedValue(0);
    job = new SuggestionAnalysisJob(database, runtime, processor, maintenance);
  });

  afterEach(() => vi.useRealTimers());

  it("KST 일일 스케줄을 등록하고 processor를 연결한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-09T07:00:00+09:00") });
    job.onModuleInit();
    await job.schedulerRegistration;

    expect(runtime.schedule).toHaveBeenCalledWith(
      "daily-suggestion-scheduler",
      "30 7 * * *",
      AI_SUGGESTION_QUEUE,
      { name: "dispatch-analysis", data: {} },
      expect.objectContaining({ timezone: "Asia/Seoul" }),
    );
    expect(processor.setSuggestionJob).toHaveBeenCalledWith(job);
  });

  it("07:30 이후 재시작하면 당일 dispatch를 멱등 키로 보정한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-09T08:00:00+09:00") });
    job.onModuleInit();
    await job.schedulerRegistration;

    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_SUGGESTION_QUEUE,
      { name: "dispatch-analysis", data: {} },
      expect.objectContaining({ idempotencyKey: "dispatch_suggestion_2026-03-09" }),
    );
  });

  it("최근 활동 사용자마다 분석 작업을 등록한다", async () => {
    asMock(database.db.orm.public.User.all).mockReturnValue(
      nativeRows(
        databaseFixture(
          "User",
          [
            { id: "user-1", preference: { timezone: "Asia/Seoul" }, location: null },
            {
              id: "user-2",
              preference: { timezone: "America/New_York" },
              location: null,
            },
          ].map((value) => ({ ...UserBuilder.create().build(), ...value })),
        ),
      ),
    );

    await job.dispatchAnalysis();

    expect(runtime.enqueue).toHaveBeenCalledTimes(2);
    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_SUGGESTION_QUEUE,
      expect.objectContaining({
        name: "analyze-suggestion",
        data: expect.objectContaining({
          userId: "user-1",
          timezone: "Asia/Seoul",
        }),
      }),
      expect.objectContaining({ retryLimit: 2, retryBackoff: true }),
    );
  });

  it("사용자가 없으면 분석 작업을 만들지 않는다", async () => {
    asMock(database.db.orm.public.User.all).mockReturnValue(
      nativeRows(databaseFixture("User", [])),
    );
    await job.dispatchAnalysis();

    expect(runtime.enqueue).not.toHaveBeenCalled();
  });
});

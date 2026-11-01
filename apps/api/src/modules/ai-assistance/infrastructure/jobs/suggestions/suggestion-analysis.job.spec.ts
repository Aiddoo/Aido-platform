import type { TransactionHost } from "@nestjs-cls/transactional";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { UserBuilder } from "#test/builders/index";

import { SuggestionAnalysisProcessor } from "../../processors/suggestions/suggestion-analysis.processor.js";
import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service.js";
import { AI_SUGGESTION_QUEUE } from "./ai-suggestion-queue.js";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job.js";

function createUserQueryHost() {
  const findMany = vi.fn();
  const host = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => ({ query: { user: { findMany } } }) });
  return { host, findMany };
}

describe("SuggestionAnalysisJob — 영속 추천 분석 job 발행", () => {
  let job: SuggestionAnalysisJob;
  let findMany: ReturnType<typeof createUserQueryHost>["findMany"];
  let runtime: Mocked<JobRuntimePort>;
  let processor: Mocked<SuggestionAnalysisProcessor>;

  beforeEach(async () => {
    const userQuery = createUserQueryHost();
    findMany = userQuery.findMany;
    runtime = mock<JobRuntimePort>();
    runtime.schedule.mockResolvedValue(undefined);
    runtime.enqueue.mockResolvedValue("job-1");
    processor = mock<SuggestionAnalysisProcessor>();
    const maintenance = mock<AiSuggestionQueueMaintenanceService>();
    maintenance.cleanExpiredFailures.mockResolvedValue(0);
    job = new SuggestionAnalysisJob(userQuery.host, runtime, processor, maintenance);
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
    findMany.mockResolvedValue(
      [
        { id: "user-1", preference: { timezone: "Asia/Seoul" }, location: null },
        {
          id: "user-2",
          preference: { timezone: "America/New_York" },
          location: null,
        },
      ].map((value) => ({ ...UserBuilder.create().build(), ...value })),
    );

    await job.dispatchAnalysis();

    expect(runtime.enqueueMany).toHaveBeenCalledOnce();
    expect(runtime.enqueueMany).toHaveBeenCalledWith(AI_SUGGESTION_QUEUE, [
      {
        data: expect.objectContaining({
          name: "analyze-suggestion",
          data: expect.objectContaining({ userId: "user-1", timezone: "Asia/Seoul" }),
        }),
        options: expect.objectContaining({ retryLimit: 2, retryBackoff: true }),
      },
      expect.objectContaining({
        data: expect.objectContaining({ data: expect.objectContaining({ userId: "user-2" }) }),
      }),
    ]);
  });

  it("사용자가 없으면 분석 작업을 만들지 않는다", async () => {
    findMany.mockResolvedValue([]);
    await job.dispatchAnalysis();

    expect(runtime.enqueue).not.toHaveBeenCalled();
  });
});

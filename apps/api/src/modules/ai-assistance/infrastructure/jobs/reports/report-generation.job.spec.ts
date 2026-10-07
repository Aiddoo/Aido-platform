import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { UserBuilder } from "#test/builders/index";
import { createMockTransactionHost, databaseFixture, nativeRows } from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { ReportGenerationProcessor } from "../../processors/reports/report-generation.processor.js";
import { AI_REPORT_QUEUE } from "./ai-report-queue.js";
import { ReportGenerationJob } from "./report-generation.job.js";

describe("ReportGenerationJob — 영속 보고서 생성 job 발행", () => {
  let job: ReportGenerationJob;
  let database: MockDatabaseContext;
  let runtime: Mocked<JobRuntimePort>;
  let processor: Mocked<ReportGenerationProcessor>;

  beforeEach(async () => {
    database = createMockDatabaseContext();
    runtime = mock<JobRuntimePort>();
    runtime.schedule.mockResolvedValue(undefined);
    runtime.enqueue.mockResolvedValue("job-1");
    processor = mock<ReportGenerationProcessor>();
    job = new ReportGenerationJob(createMockTransactionHost(database), runtime, processor);
  });

  afterEach(() => vi.useRealTimers());

  it("KST 주간·월간 스케줄을 등록하고 processor를 연결한다", async () => {
    vi.useFakeTimers({ now: new Date("2026-03-10T10:00:00+09:00") });
    job.onModuleInit();
    await job.schedulerRegistration;

    expect(runtime.schedule).toHaveBeenCalledTimes(2);
    expect(runtime.schedule).toHaveBeenCalledWith(
      "weekly-report-scheduler",
      "0 1 * * 1",
      AI_REPORT_QUEUE,
      { name: "dispatch-reports", data: { reportType: "WEEKLY" } },
      expect.objectContaining({ timezone: "Asia/Seoul" }),
    );
    expect(processor.setReportJob).toHaveBeenCalledWith(job);
  });

  it("월요일 01시 이후 재시작하면 주간 dispatch를 멱등 키로 보정한다", async () => {
    vi.useFakeTimers({ now: new Date("2026-03-09T03:00:00+09:00") });
    job.onModuleInit();
    await job.schedulerRegistration;

    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_REPORT_QUEUE,
      { name: "dispatch-reports", data: { reportType: "WEEKLY" } },
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("dispatch_WEEKLY_"),
      }),
    );
  });

  it("대상 사용자마다 생성 작업과 재시도 정책을 등록한다", async () => {
    asMock(database.orm.public.User.all).mockReturnValue(
      nativeRows(
        databaseFixture(
          "User",
          [
            { id: "user-1", preference: { timezone: "Asia/Seoul", locale: "ko" } },
            {
              id: "user-2",
              preference: { timezone: "America/New_York", locale: "en" },
            },
          ].map((value) => ({ ...UserBuilder.create().build(), ...value })),
        ),
      ),
    );

    await job.dispatchReports("WEEKLY");

    expect(runtime.enqueue).toHaveBeenCalledTimes(2);
    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_REPORT_QUEUE,
      expect.objectContaining({
        name: "generate-report",
        data: expect.objectContaining({
          userId: "user-1",
          reportType: "WEEKLY",
        }),
      }),
      expect.objectContaining({ retryLimit: 2, retryBackoff: true }),
    );
  });

  it("preference가 없으면 기존 기본값을 유지한다", async () => {
    asMock(database.orm.public.User.all).mockReturnValue(
      nativeRows(
        databaseFixture(
          "User",
          [{ id: "user-1", preference: null }].map((value) => ({
            ...UserBuilder.create().build(),
            ...value,
          })),
        ),
      ),
    );
    await job.dispatchReports("MONTHLY");

    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_REPORT_QUEUE,
      expect.objectContaining({
        data: expect.objectContaining({ timezone: "Asia/Seoul", locale: "ko" }),
      }),
      expect.any(Object),
    );
  });
});

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

  function usersFixture(values: Array<{ id: string; preference: unknown }>) {
    asMock(database.orm.public.User.all).mockReturnValue(
      nativeRows(
        databaseFixture(
          "User",
          values.map((value) => ({ ...UserBuilder.create().build(), ...value })),
        ),
      ),
    );
  }

  it("주간·월간 디스패치를 매시 스케줄로 등록하고 processor를 연결한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-10T10:00:00+09:00") });
    // When
    job.onModuleInit();
    await job.schedulerRegistration;
    // Then
    expect(runtime.schedule).toHaveBeenCalledTimes(2);
    for (const [name, reportType] of [
      ["weekly-report-scheduler", "WEEKLY"],
      ["monthly-report-scheduler", "MONTHLY"],
    ]) {
      expect(runtime.schedule).toHaveBeenCalledWith(
        name,
        "5 * * * *",
        AI_REPORT_QUEUE,
        { name: "dispatch-reports", data: { reportType } },
        expect.objectContaining({ timezone: "UTC" }),
      );
    }
    expect(processor.setReportJob).toHaveBeenCalledWith(job);
  });

  it("재시작하면 놓친 매시 디스패치를 UTC 시각 멱등 키로 보정한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T07:40:00Z") });
    // When
    job.onModuleInit();
    await job.schedulerRegistration;
    // Then
    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_REPORT_QUEUE,
      { name: "dispatch-reports", data: { reportType: "WEEKLY" } },
      expect.objectContaining({ idempotencyKey: "dispatch_WEEKLY_2026-10-26T07" }),
    );
    expect(runtime.enqueue).toHaveBeenCalledWith(
      AI_REPORT_QUEUE,
      { name: "dispatch-reports", data: { reportType: "MONTHLY" } },
      expect.objectContaining({ idempotencyKey: "dispatch_MONTHLY_2026-10-26T07" }),
    );
  });

  it("로컬 월요일 자정 직후인 사용자만 로컬 주차 멱등 키로 등록한다", async () => {
    // Given - 서울 월 00:05, LA 일 08:05인 순간
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-25T15:05:00Z") });
    usersFixture([
      { id: "user-seoul", preference: { timezone: "Asia/Seoul", locale: "ko" } },
      { id: "user-la", preference: { timezone: "America/Los_Angeles", locale: "en" } },
    ]);
    // When
    await job.dispatchReports("WEEKLY");
    // Then
    expect(runtime.enqueueMany).toHaveBeenCalledOnce();
    expect(runtime.enqueueMany).toHaveBeenCalledWith(AI_REPORT_QUEUE, [
      {
        data: {
          name: "generate-report",
          data: {
            userId: "user-seoul",
            timezone: "Asia/Seoul",
            locale: "ko",
            reportType: "WEEKLY",
          },
        },
        options: expect.objectContaining({
          retryBackoff: true,
          idempotencyKey: "report_WEEKLY_user-seoul_2026-W44",
        }),
      },
    ]);
  });

  it("LA 월요일 자정 직후에는 LA 사용자의 지난 주를 등록한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T07:05:00Z") });
    usersFixture([
      { id: "user-seoul", preference: { timezone: "Asia/Seoul", locale: "ko" } },
      { id: "user-la", preference: { timezone: "America/Los_Angeles", locale: "en" } },
    ]);
    // When
    await job.dispatchReports("WEEKLY");
    // Then
    expect(runtime.enqueueMany).toHaveBeenCalledWith(AI_REPORT_QUEUE, [
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({ userId: "user-la", timezone: "America/Los_Angeles" }),
        }),
        options: expect.objectContaining({ idempotencyKey: "report_WEEKLY_user-la_2026-W44" }),
      }),
    ]);
  });

  it("창 밖의 사용자뿐이면 큐에 등록하지 않는다", async () => {
    // Given - 수요일
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T03:05:00Z") });
    usersFixture([{ id: "user-seoul", preference: { timezone: "Asia/Seoul", locale: "ko" } }]);
    // When
    await job.dispatchReports("WEEKLY");
    // Then
    expect(runtime.enqueueMany).not.toHaveBeenCalled();
  });

  it("preference가 없으면 기존 기본 타임존과 언어로 월간 창을 판단한다", async () => {
    // Given - KST 11월 1일 00:05
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-31T15:05:00Z") });
    usersFixture([{ id: "user-1", preference: null }]);
    // When
    await job.dispatchReports("MONTHLY");
    // Then
    expect(runtime.enqueueMany).toHaveBeenCalledWith(AI_REPORT_QUEUE, [
      {
        data: expect.objectContaining({
          data: expect.objectContaining({ timezone: "Asia/Seoul", locale: "ko" }),
        }),
        options: expect.objectContaining({ idempotencyKey: "report_MONTHLY_user-1_2026-M11" }),
      },
    ]);
  });
});

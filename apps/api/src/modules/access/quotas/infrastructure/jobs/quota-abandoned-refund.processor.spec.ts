import { Logger } from "@nestjs/common";

import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import {
  QUOTA_ABANDONED_REFUND_QUEUE,
  QuotaAbandonedRefundJob,
} from "./quota-abandoned-refund.processor.js";

describe("QuotaAbandonedRefundJob", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("작업자와 주기 실행을 등록하고 실행되면 멈춘 예약을 돌려준다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const refundAbandonedReservations = vi.fn(async () => undefined);
    const job = new QuotaAbandonedRefundJob({ refundAbandonedReservations }, runtime);
    // When
    await job.onModuleInit();
    await job.schedulerRegistration;
    await job.refund();
    // Then
    expect(runtime.workCalls).toEqual([
      expect.objectContaining({ queue: QUOTA_ABANDONED_REFUND_QUEUE }),
    ]);
    expect(runtime.scheduleCalls).toEqual([
      expect.objectContaining({ queue: QUOTA_ABANDONED_REFUND_QUEUE, cron: "*/10 * * * *" }),
    ]);
    expect(refundAbandonedReservations).toHaveBeenCalledTimes(1);
  });

  it("작업자 등록이 실패하면 조용히 넘어가지 않고 기동을 멈춘다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    vi.spyOn(runtime, "work").mockRejectedValueOnce(new Error("queue unavailable"));
    const job = new QuotaAbandonedRefundJob(
      { refundAbandonedReservations: async () => undefined },
      runtime,
    );
    // When
    const init = job.onModuleInit();
    // Then
    await expect(init).rejects.toThrow("queue unavailable");
  });

  it("원장을 읽지 못하면 원인 종류를 남기고 잡 재시도를 위해 다시 던진다", async () => {
    // Given
    const failure = new TypeError("db down");
    const job = new QuotaAbandonedRefundJob(
      { refundAbandonedReservations: () => Promise.reject(failure) },
      new FakeJobRuntime(),
    );
    // When
    const execution = job.refund();
    // Then
    await expect(execution).rejects.toBe(failure);
    expect(Logger.prototype.error).toHaveBeenCalledWith({
      event: "access.quota.abandoned-refund.failed",
      errorType: "TypeError",
    });
  });
});

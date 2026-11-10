import { Logger } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { ADMIN_NOTIFICATION_QUEUE } from "./admin-notification.queue.js";
import { DailySignupSummaryScheduler } from "./daily-signup-summary.scheduler.js";

// 스케줄 등록이 실패하는 저장소를 흉내 낸다
class FailingScheduleJobQueue extends InMemoryJobQueue {
  readonly failure: Error;

  constructor(failure: Error) {
    super();
    this.failure = failure;
  }

  override async registerSchedules(): Promise<void> {
    throw this.failure;
  }
}

describe("DailySignupSummaryScheduler — 스케줄 등록 격리", () => {
  it("부팅을 블로킹하지 않고 큐 정의의 스케줄을 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new DailySignupSummaryScheduler(jobQueue);

    // When
    expect(scheduler.onModuleInit()).toBeUndefined();
    await scheduler.registration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual([ADMIN_NOTIFICATION_QUEUE.name]);
  });

  it("등록 오류의 원문을 숨기고 완료 promise를 reject하지 않는다", async () => {
    // Given
    const secret = "synthetic-private-queue-credential";
    const jobQueue: JobQueuePort = new FailingScheduleJobQueue(new Error(secret));
    const scheduler = new DailySignupSummaryScheduler(jobQueue);
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    // When
    scheduler.onModuleInit();

    // Then
    await expect(scheduler.registration).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledOnce();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
});

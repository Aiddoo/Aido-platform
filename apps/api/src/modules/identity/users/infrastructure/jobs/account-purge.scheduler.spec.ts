import type { QueueDefinition } from "#api/shared/application/ports/job-queue.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { ACCOUNT_PURGE_QUEUE } from "./account-purge.queue.js";
import { AccountPurgeScheduler } from "./account-purge.scheduler.js";

class ControlledScheduleQueue extends InMemoryJobQueue {
  scheduleOutcome: () => Promise<void> = async () => undefined;

  override async registerSchedules(queue: QueueDefinition<object>): Promise<void> {
    await this.scheduleOutcome();
    await super.registerSchedules(queue);
  }
}

describe("AccountPurgeJob — 일일 스케줄과 재시작 보정", () => {
  let jobQueue: ControlledScheduleQueue;
  let job: AccountPurgeScheduler;

  beforeEach(() => {
    jobQueue = new ControlledScheduleQueue();
    job = new AccountPurgeScheduler(
      jobQueue,
      new FixedClock(Temporal.Instant.from("2026-12-31T00:00:00Z")),
    );
  });

  it.each([
    { at: "2026-12-31T17:59:59.999Z", key: undefined },
    { at: "2026-12-31T18:00:00.000Z", key: "purge_2027-01-01" },
    { at: "2027-01-01T14:59:59.999Z", key: "purge_2027-01-01" },
  ])("KST 03:00 경계와 연말 시각 $at에서 기존 스케줄·보정 키를 유지한다", async ({ at, key }) => {
    // Given
    job = new AccountPurgeScheduler(jobQueue, new FixedClock(Temporal.Instant.from(at)));

    // When
    job.onModuleInit();
    await job.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual(["account-purge.v1"]);
    expect(
      ACCOUNT_PURGE_QUEUE.schedules?.map(({ key: scheduleKey, cron }) => [scheduleKey, cron]),
    ).toEqual([["daily-account-purge-scheduler", "0 3 * * *"]]);
    expect(
      jobQueue.jobsIn(ACCOUNT_PURGE_QUEUE).map((queued) => queued.options.idempotencyKey),
    ).toEqual(key == null ? [] : [key]);
  });

  it("스케줄 등록이 대기 중이어도 API 부팅은 즉시 계속된다", async () => {
    // Given
    let release = (): void => undefined;
    jobQueue.scheduleOutcome = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });

    // When
    const result = job.onModuleInit();

    // Then
    try {
      expect(result).toBeUndefined();
      expect(jobQueue.jobs).toEqual([]);
    } finally {
      release();
      await job.schedulerRegistration;
    }
  });

  it("스케줄 등록 실패는 부팅 실패로 전파하지 않고 보정 잡을 만들지 않는다", async () => {
    // Given
    job = new AccountPurgeScheduler(
      jobQueue,
      new FixedClock(Temporal.Instant.from("2026-12-31T18:00:00.000Z")),
    );
    jobQueue.scheduleOutcome = () => Promise.reject(new Error("Queue unavailable"));

    // When
    job.onModuleInit();

    // Then
    await expect(job.schedulerRegistration).resolves.toBeUndefined();
    expect(jobQueue.jobs).toEqual([]);
  });
});

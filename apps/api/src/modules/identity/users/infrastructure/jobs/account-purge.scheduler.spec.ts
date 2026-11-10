import type { EnqueueJobOptions, JobData } from "#api/shared/application/ports/job-runtime.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { AccountPurgeScheduler } from "./account-purge.scheduler.js";

class ControlledScheduleRuntime extends FakeJobRuntime {
  scheduleOutcome: () => Promise<void> = async () => undefined;

  override async schedule<T extends JobData>(
    scheduleKey: string,
    cron: string,
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<void> {
    await this.scheduleOutcome();
    await super.schedule(scheduleKey, cron, queue, data, options);
  }
}

describe("AccountPurgeJob — 일일 스케줄과 재시작 보정", () => {
  let runtime: ControlledScheduleRuntime;
  let clock: FixedClock;
  let job: AccountPurgeScheduler;

  beforeEach(() => {
    runtime = new ControlledScheduleRuntime();
    clock = new FixedClock(Temporal.Instant.from("2026-12-31T00:00:00Z"));
    job = new AccountPurgeScheduler(runtime, clock);
  });

  it.each([
    { at: "2026-12-31T17:59:59.999Z", key: undefined },
    { at: "2026-12-31T18:00:00.000Z", key: "purge_2027-01-01" },
    { at: "2027-01-01T14:59:59.999Z", key: "purge_2027-01-01" },
  ])("KST 03:00 경계와 연말 시각 $at에서 기존 스케줄·보정 키를 유지한다", async ({ at, key }) => {
    // Given
    clock = new FixedClock(Temporal.Instant.from(at));
    job = new AccountPurgeScheduler(runtime, clock);
    const options = {
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 1800,
      retentionSeconds: 604_800,
      deleteAfterSeconds: 86_400,
      timezone: "Asia/Seoul",
    };

    // When
    job.onModuleInit();
    await job.schedulerRegistration;

    // Then
    expect(runtime.scheduleCalls).toEqual([
      {
        scheduleKey: "daily-account-purge-scheduler",
        cron: "0 3 * * *",
        queue: "account-purge.v1",
        data: { name: "purge-accounts", data: {} },
        options,
      },
    ]);
    expect(runtime.enqueueCalls).toEqual(
      key == null
        ? []
        : [
            {
              queue: "account-purge.v1",
              data: { name: "purge-accounts", data: {} },
              options: { ...options, idempotencyKey: key },
            },
          ],
    );
  });

  it("스케줄 등록이 대기 중이어도 API 부팅은 즉시 계속된다", async () => {
    // Given
    let release = (): void => undefined;
    runtime.scheduleOutcome = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });

    // When
    const result = job.onModuleInit();

    // Then
    try {
      expect(result).toBeUndefined();
      expect(runtime.enqueueCalls).toEqual([]);
    } finally {
      release();
      await job.schedulerRegistration;
    }
  });

  it("스케줄 등록 실패는 부팅 실패로 전파하지 않고 보정 잡을 만들지 않는다", async () => {
    // Given
    job = new AccountPurgeScheduler(
      runtime,
      new FixedClock(Temporal.Instant.from("2026-12-31T18:00:00.000Z")),
    );
    runtime.scheduleOutcome = () => Promise.reject(new Error("Queue unavailable"));

    // When
    job.onModuleInit();

    // Then
    await expect(job.schedulerRegistration).resolves.toBeUndefined();
    expect(runtime.enqueueCalls).toEqual([]);
  });
});

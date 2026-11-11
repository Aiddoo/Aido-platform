import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { TEST_CUID } from "#test/fixtures/index";

import type { ReminderHourChangedJobData } from "../../application/ports/timezone-reminder-enqueuer.port.js";
import { TimezoneReminderQueueAdapter } from "./timezone-reminder-queue.adapter.js";
import { TimezoneReminderSweepScheduler } from "./timezone-reminder-sweep.scheduler.js";
import { TIMEZONE_REMINDER_QUEUE, TimezoneReminderJobName } from "./timezone-reminder.queue.js";

const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

describe("TimezoneReminderQueueAdapter — 리마인더 큐 등록", () => {
  let jobQueue: InMemoryJobQueue;
  let service: TimezoneReminderQueueAdapter;

  beforeEach(() => {
    jobQueue = new InMemoryJobQueue();
    service = new TimezoneReminderQueueAdapter(jobQueue, new FixedClock(NOW));
  });

  it("리마인더 시간 변경을 판별 가능한 메시지로 등록한다", async () => {
    // Given
    const payload: ReminderHourChangedJobData = {
      userId: "user-1",
      timezone: "Asia/Seoul",
      morningReminderHour: 8,
      morningReminderMinute: 0,
    };

    // When
    service.enqueueReminderHourChanged(payload);

    // Then
    await vi.waitFor(() => {
      expect(jobQueue.jobsIn(TIMEZONE_REMINDER_QUEUE)).toEqual([
        expect.objectContaining({
          payload: { name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED, data: payload },
        }),
      ]);
    });
  });

  it("social digest를 90분 뒤 시작하도록 등록한다", async () => {
    // When
    service.enqueueSocialDigest({ timezone: "Asia/Seoul", recipientUserIds: [TEST_CUID.USER_1] });

    // Then
    await vi.waitFor(() => {
      expect(jobQueue.jobsIn(TIMEZONE_REMINDER_QUEUE)).toHaveLength(1);
    });
    const [job] = jobQueue.jobsIn(TIMEZONE_REMINDER_QUEUE);
    expect(job?.payload).toMatchObject({ name: TimezoneReminderJobName.SOCIAL_DIGEST });
    expect(job?.options.startAfter).toEqual(NOW.add({ minutes: 90 }));
  });

  it("매분 sweep 스케줄을 서울 시간 기준·놓친 실행 하나로 등록한다", async () => {
    // Given
    const scheduler = new TimezoneReminderSweepScheduler(jobQueue);

    // When
    scheduler.onModuleInit();
    await scheduler.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual([TIMEZONE_REMINDER_QUEUE.name]);
    expect(TIMEZONE_REMINDER_QUEUE.schedules).toEqual([
      expect.objectContaining({
        key: "tz-reminder-sweep-scheduler",
        cron: "* * * * *",
        timezone: "Asia/Seoul",
        missed: "once",
      }),
    ]);
  });
});

import { Logger } from "@nestjs/common";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import {
  ADMIN_NOTIFICATION_QUEUE,
  AdminNotificationJobName,
  DAILY_SIGNUP_SUMMARY_SCHEDULE,
} from "./admin-notification-queue.constants.js";
import { DailySignupSummaryScheduler } from "./daily-signup-summary.scheduler.js";

function fixture() {
  const schedule = vi.fn<JobRuntimePort["schedule"]>().mockResolvedValue(undefined);
  const runtime: Pick<JobRuntimePort, "schedule"> = { schedule };
  return { schedule, scheduler: new DailySignupSummaryScheduler(runtime) };
}

describe("DailySignupSummaryScheduler registration 실패 격리", () => {
  it("부팅을 블로킹하지 않고 기존 KST 일정·잡 payload·retry policy를 등록한다", async () => {
    // Given
    const { schedule, scheduler } = fixture();
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    // When
    expect(scheduler.onModuleInit()).toBeUndefined();
    await scheduler.schedulerRegistration;

    // Then
    expect(schedule).toHaveBeenCalledExactlyOnceWith(
      DAILY_SIGNUP_SUMMARY_SCHEDULE.key,
      "10 0 * * *",
      ADMIN_NOTIFICATION_QUEUE,
      { name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
      { ...DAILY_SIGNUP_SUMMARY_SCHEDULE.jobPolicy, timezone: "Asia/Seoul" },
    );
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotificationInfraEvent.SCHEDULE_REGISTERED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
    });
  });

  it("registration 오류의 원문을 숨기고 기존 완료 promise를 reject하지 않는다", async () => {
    // Given
    const { schedule, scheduler } = fixture();
    const secret = "synthetic-private-queue-credential";
    schedule.mockRejectedValue(new Error(secret));
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    // When
    expect(scheduler.onModuleInit()).toBeUndefined();

    // Then
    await expect(scheduler.schedulerRegistration).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotificationInfraEvent.SCHEDULE_FAILED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      errorType: "schedule",
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
});

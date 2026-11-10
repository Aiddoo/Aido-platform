import { RecordingAdminNotificationQueue } from "#test/doubles/operations/recording-admin-notification-queue";
import { StubAdminNotifier } from "#test/doubles/operations/stub-admin-notifier";
import { StubSignupStatsReader } from "#test/doubles/operations/stub-signup-stats.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification.use-case.js";
import { AdminNotificationProcessor } from "./admin-notification.processor.js";
import { ADMIN_NOTIFICATION_QUEUE, AdminNotificationJobName } from "./admin-notification.queue.js";

async function setup() {
  const jobQueue = new InMemoryJobQueue();
  const notifier = new StubAdminNotifier();
  const statsReader = new StubSignupStatsReader();
  const summaryQueue = new RecordingAdminNotificationQueue();
  const processor = new AdminNotificationProcessor(
    jobQueue,
    new SendAdminNotificationUseCase({
      notifier,
      alert: new RecordingOperationalAlert(),
      logger: new SilentLogger(),
    }),
    new DispatchDailySignupSummaryUseCase({
      statsReader,
      queue: summaryQueue,
      clock: new FixedClock(Temporal.Instant.from("2026-02-10T15:00:00Z")),
      logger: new SilentLogger(),
    }),
  );
  await processor.onModuleInit();
  return { jobQueue, notifier, summaryQueue, statsReader };
}

describe("AdminNotificationProcessor — 관리자 알림 작업 소비", () => {
  it("SEND 작업은 채널과 알림을 발송 포트에 넘긴다", async () => {
    // Given
    const { jobQueue, notifier } = await setup();
    const notice = {
      type: "message",
      message: { title: "테스트", body: "내용", severity: "success" },
    } as const;
    await jobQueue.enqueue(ADMIN_NOTIFICATION_QUEUE, {
      name: AdminNotificationJobName.SEND,
      data: { channel: "payment", notice },
    });

    // When
    await jobQueue.drain(ADMIN_NOTIFICATION_QUEUE);

    // Then
    expect(notifier.sent).toEqual([{ channel: "payment", notice }]);
  });

  it("DISPATCH_SUMMARY 작업은 일일 가입 요약을 등록하고 발송은 하지 않는다", async () => {
    // Given
    const { jobQueue, notifier, summaryQueue, statsReader } = await setup();
    statsReader.result = { signupsByProvider: [], totalUsers: 10 };
    await jobQueue.enqueue(ADMIN_NOTIFICATION_QUEUE, {
      name: AdminNotificationJobName.DISPATCH_SUMMARY,
      data: {},
    });

    // When
    await jobQueue.drain(ADMIN_NOTIFICATION_QUEUE);

    // Then
    expect(summaryQueue.sent.map(({ options }) => options)).toEqual([
      { jobId: "signup-summary_2026-02-10" },
    ]);
    expect(notifier.sent).toEqual([]);
  });

  it("재시도 가능한 발송 실패는 같은 오류로 전파해 큐 재시도 의미를 유지한다", async () => {
    // Given
    const { jobQueue, notifier } = await setup();
    notifier.outcome = { status: "failed", retryable: true, statusCode: 503 };
    await jobQueue.enqueue(ADMIN_NOTIFICATION_QUEUE, {
      name: AdminNotificationJobName.SEND,
      data: {
        channel: "admin",
        notice: { type: "message", message: { title: "제목", body: "본문", severity: "info" } },
      },
    });

    // When
    const drained = jobQueue.drain(ADMIN_NOTIFICATION_QUEUE);

    // Then
    await expect(drained).rejects.toMatchObject({ name: "AdminNotificationRetryableError" });
  });
});

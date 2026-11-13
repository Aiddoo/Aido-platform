import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

import { ADMIN_NOTIFICATION_QUEUE, AdminNotificationJobName } from "./admin-notification.queue.js";

const parse = (job: unknown) => ADMIN_NOTIFICATION_QUEUE.payloadSchema.parse(job);
const safeParse = (job: unknown) => ADMIN_NOTIFICATION_QUEUE.payloadSchema.safeParse(job);

describe("관리자 알림 큐 정의", () => {
  it("queue 이름·재시도·worker·스케줄 key를 기존 운영 계약으로 유지한다", () => {
    expect(ADMIN_NOTIFICATION_QUEUE.name).toBe("admin-notification.v1");
    expect(ADMIN_NOTIFICATION_QUEUE.retry).toEqual({
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 300,
      retentionSeconds: 86_400,
      deleteAfterSeconds: 86_400,
    });
    // 관리자 공지는 사람이 기다리지 않는다 — 폴링은 예약 작업 주기를 따른다
    expect(ADMIN_NOTIFICATION_QUEUE.worker).toEqual({
      localConcurrency: 3,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
    });
    expect(ADMIN_NOTIFICATION_QUEUE.schedules).toEqual([
      {
        key: "daily-signup-summary-scheduler",
        cron: "10 0 * * *",
        timezone: "Asia/Seoul",
        missed: "once",
        payload: { name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
      },
    ]);
  });

  it("새 형식의 구독 알림 잡을 그대로 받는다", () => {
    // Given
    const job = {
      name: AdminNotificationJobName.SEND,
      data: {
        channel: "payment",
        notice: {
          type: "subscription_event",
          user: { userId: "user-1", email: "user@example.com", userTag: "MATT2025" },
          subscription: {
            event: "billing_issue",
            environment: "PRODUCTION",
            store: "PLAY_STORE",
            price: { amount: 3900, currency: "KRW", usd: 2.99 },
            endReason: "BILLING_ERROR",
            premium: { source: "STORE", bankedDays: 7, isTrial: false },
          },
        },
      },
    };

    // Then
    expect(parse(job)).toEqual(job);
  });

  it("표시용 값이 모르는 값이면 잡을 버리지 않고 그 칸만 비운다", () => {
    // Given
    const job = {
      name: AdminNotificationJobName.SEND,
      data: {
        channel: "payment",
        notice: {
          type: "subscription_event",
          user: { userId: "user-1", email: "user@example.com", signupMethod: "LINE" },
          subscription: { event: "renewed", store: "NEW_STORE", price: {} },
        },
      },
    };

    // Then
    expect(parse(job).data).toEqual({
      channel: "payment",
      notice: {
        type: "subscription_event",
        user: { userId: "user-1", email: "user@example.com" },
        subscription: { event: "renewed", price: {} },
      },
    });
  });

  it("모르는 채널·알림 종류·이벤트는 받지 않는다", () => {
    for (const data of [
      { channel: "unknown", notice: { type: "message", message: {} } },
      { channel: "admin", notice: { type: "unknown" } },
      {
        channel: "payment",
        notice: {
          type: "subscription_event",
          user: { userId: "user-1", email: "user@example.com" },
          subscription: { event: "unknown_event", price: {} },
        },
      },
    ]) {
      expect(safeParse({ name: AdminNotificationJobName.SEND, data }).success).toBe(false);
    }
  });
});

import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { AdminNotice } from "../../domain/admin-notice.aggregate.js";
import { ADMIN_NOTIFICATION_QUEUE } from "../jobs/admin-notification.queue.js";
import { AdminNotificationQueueAdapter } from "./admin-notification-queue.adapter.js";

const message = {
  type: "message",
  message: { title: "제목", body: "본문", severity: "info" },
} as const;

const subscription = {
  type: "subscription_event",
  user: { userId: "user-1", email: "billing@example.com" },
  subscription: { event: "renewed", price: {} },
} as const;

describe("AdminNotificationQueueAdapter — 관리자 알림 작업 등록", () => {
  it("SEND 작업으로 알림의 채널과 값을 옛 payload 모양 그대로 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new AdminNotificationQueueAdapter(jobQueue);

    // When
    await adapter.enqueueSend(AdminNotice.create({ content: message }));
    await adapter.enqueueSend(AdminNotice.create({ content: subscription }));

    // Then
    expect(jobQueue.jobsIn(ADMIN_NOTIFICATION_QUEUE)).toEqual([
      {
        queue: "admin-notification.v1",
        payload: { name: "send-notification", data: { channel: "admin", notice: message } },
        options: {},
      },
      {
        queue: "admin-notification.v1",
        payload: {
          name: "send-notification",
          data: { channel: "payment", notice: subscription },
        },
        options: {},
      },
    ]);
  });

  it("중복 방지 key가 멱등 key가 되어 같은 key의 두 번째 등록은 큐에 남지 않는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new AdminNotificationQueueAdapter(jobQueue);
    const deduplicationKey = "subscription-event_evt-1";

    // When
    await adapter.enqueueSend(AdminNotice.create({ content: subscription, deduplicationKey }));
    await adapter.enqueueSend(AdminNotice.create({ content: subscription, deduplicationKey }));

    // Then
    expect(jobQueue.jobsIn(ADMIN_NOTIFICATION_QUEUE).map(({ options }) => options)).toEqual([
      { idempotencyKey: "subscription-event_evt-1" },
    ]);
  });
});

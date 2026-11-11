import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { ADMIN_NOTIFICATION_QUEUE } from "../jobs/admin-notification.queue.js";
import { AdminNotificationQueueAdapter } from "./admin-notification-queue.adapter.js";

const notice = {
  type: "message",
  message: { title: "제목", body: "본문", severity: "info" },
} as const;

describe("AdminNotificationQueueAdapter — 관리자 알림 작업 등록", () => {
  it("SEND 작업으로 채널과 알림을 큐에 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new AdminNotificationQueueAdapter(jobQueue);

    // When
    await adapter.enqueueSend("admin", notice);

    // Then
    expect(jobQueue.jobsIn(ADMIN_NOTIFICATION_QUEUE)).toEqual([
      {
        queue: "admin-notification.v1",
        payload: { name: "send-notification", data: { channel: "admin", notice } },
        options: {},
      },
    ]);
  });

  it("jobId는 멱등 key가 되어 같은 jobId의 두 번째 등록은 큐에 남지 않는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new AdminNotificationQueueAdapter(jobQueue);

    // When
    await adapter.enqueueSend("payment", notice, { jobId: "subscription-event_evt-1" });
    await adapter.enqueueSend("payment", notice, { jobId: "subscription-event_evt-1" });

    // Then
    expect(jobQueue.jobsIn(ADMIN_NOTIFICATION_QUEUE).map(({ options }) => options)).toEqual([
      { idempotencyKey: "subscription-event_evt-1" },
    ]);
  });
});

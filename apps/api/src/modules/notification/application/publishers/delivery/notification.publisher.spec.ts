import { vi } from "vitest";

import type { SendBatchNotification } from "../../use-cases/delivery/send-batch-notification.use-case.js";
import type { SendNotificationWithDedup } from "../../use-cases/delivery/send-notification-with-dedup.use-case.js";
import type { SendNotification } from "../../use-cases/delivery/send-notification.use-case.js";
import { NotificationPublisher } from "./notification.publisher.js";

describe("NotificationPublisher", () => {
  it("발행 요청을 목적별 유스케이스에 위임한다", async () => {
    const send: Pick<SendNotification, "execute"> = { execute: vi.fn().mockResolvedValue(null) };
    const sendWithDeduplication: Pick<SendNotificationWithDedup, "execute"> = {
      execute: vi.fn().mockResolvedValue(null),
    };
    const sendBatch: Pick<SendBatchNotification, "execute"> = {
      execute: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const publisher = new NotificationPublisher({
      sendNotification: send,
      sendNotificationWithDeduplication: sendWithDeduplication,
      sendBatchNotification: sendBatch,
    });
    const input = { userId: "user-1", type: "SYSTEM_NOTICE" as const, title: "제목", body: "본문" };

    await publisher.publish(input);
    await publisher.publishWithDeduplication(input);
    await publisher.publishBatch([input]);

    expect(send.execute).toHaveBeenCalledWith(input);
    expect(sendWithDeduplication.execute).toHaveBeenCalledWith(input);
    expect(sendBatch.execute).toHaveBeenCalledWith([input]);
  });
});

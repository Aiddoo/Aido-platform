import { vi } from "vitest";

import type { NotificationTodoTargetReaderPort } from "../../ports/delivery/notification-todo-target.reader.port.js";
import type { SendBatchNotification } from "../../use-cases/delivery/send-batch-notification.use-case.js";
import type { SendNotificationWithDedup } from "../../use-cases/delivery/send-notification-with-dedup.use-case.js";
import type { SendNotification } from "../../use-cases/delivery/send-notification.use-case.js";
import { NotificationPublisher } from "./notification.publisher.js";

function createPublisher(targets = new Map([[42, { ownerId: "owner-1", date: "2026-10-27" }]])) {
  const send: Pick<SendNotification, "execute"> = { execute: vi.fn().mockResolvedValue(null) };
  const sendWithDeduplication: Pick<SendNotificationWithDedup, "execute"> = {
    execute: vi.fn().mockResolvedValue(null),
  };
  const sendBatch: Pick<SendBatchNotification, "execute"> = {
    execute: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const todoTargetReader: Pick<NotificationTodoTargetReaderPort, "findTodoTargets"> = {
    findTodoTargets: vi.fn().mockResolvedValue(targets),
  };
  const publisher = new NotificationPublisher({
    sendNotification: send,
    sendNotificationWithDeduplication: sendWithDeduplication,
    sendBatchNotification: sendBatch,
    todoTargetReader,
  });
  return { publisher, send, sendWithDeduplication, sendBatch, todoTargetReader };
}

describe("NotificationPublisher", () => {
  it("할 일이 없는 발행 요청은 그대로 목적별 유스케이스에 위임한다", async () => {
    const { publisher, send, sendWithDeduplication, sendBatch, todoTargetReader } =
      createPublisher();
    const input = { userId: "user-1", type: "SYSTEM_NOTICE" as const, title: "제목", body: "본문" };

    await publisher.publish(input);
    await publisher.publishWithDeduplication(input);
    await publisher.publishBatch([input]);

    expect(send.execute).toHaveBeenCalledWith(input);
    expect(sendWithDeduplication.execute).toHaveBeenCalledWith(input);
    expect(sendBatch.execute).toHaveBeenCalledWith([input]);
    expect(todoTargetReader.findTodoTargets).not.toHaveBeenCalled();
  });

  it("할 일 알림은 기존 metadata를 지키며 할 일 주인과 날짜를 더한다", async () => {
    const { publisher, send, sendBatch } = createPublisher();
    const comment = {
      userId: "user-1",
      type: "TODO_SHARED" as const,
      title: "제목",
      body: "본문",
      todoId: 42,
      metadata: { commentId: "comment-1" },
    };
    const deleted = { ...comment, todoId: 7, metadata: null };

    await publisher.publish(comment);
    await publisher.publishBatch([comment, deleted]);

    const enriched = {
      ...comment,
      metadata: { commentId: "comment-1", todoOwnerId: "owner-1", todoDate: "2026-10-27" },
    };
    expect(send.execute).toHaveBeenCalledWith(enriched);
    expect(sendBatch.execute).toHaveBeenCalledWith([enriched, deleted]);
  });
});

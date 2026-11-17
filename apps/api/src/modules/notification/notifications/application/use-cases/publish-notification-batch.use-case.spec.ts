import { vi } from "vitest";

import { PublishNotificationBatchUseCase } from "./publish-notification-batch.use-case.js";

const notice = {
  userId: "user-1",
  type: "SYSTEM_NOTICE" as const,
  title: "제목",
  body: "본문",
};
const shared = { ...notice, type: "TODO_SHARED" as const, todoId: 42 };

function createUseCase() {
  const sendBatchNotification = { execute: vi.fn().mockResolvedValue({ count: 2 }) };
  const useCase = new PublishNotificationBatchUseCase({
    sendBatchNotification,
    todoTargetReader: {
      findTodoTargets: async () => new Map([[42, { ownerId: "owner-1", date: "2026-10-27" }]]),
    },
  });
  return { useCase, sendBatchNotification };
}

describe("PublishNotificationBatchUseCase", () => {
  it("옵션 없이 부르면 빈 옵션으로 할 일 주인·날짜를 더한 묶음을 넘긴다", async () => {
    // Given
    const { useCase, sendBatchNotification } = createUseCase();

    // When
    const result = await useCase.execute([notice, shared]);

    // Then
    expect(result).toEqual({ count: 2 });
    expect(sendBatchNotification.execute).toHaveBeenCalledWith(
      [notice, { ...shared, metadata: { todoOwnerId: "owner-1", todoDate: "2026-10-27" } }],
      {},
    );
  });

  it("받은 옵션을 그대로 넘긴다", async () => {
    // Given
    const { useCase, sendBatchNotification } = createUseCase();

    // When
    await useCase.execute([notice], { deliveryMode: "SINGLE" });

    // Then
    expect(sendBatchNotification.execute).toHaveBeenCalledWith([notice], {
      deliveryMode: "SINGLE",
    });
  });
});

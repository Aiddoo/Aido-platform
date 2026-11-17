import { vi } from "vitest";

import { PublishDeduplicatedNotificationUseCase } from "./publish-deduplicated-notification.use-case.js";

const nudge = {
  userId: "user-1",
  type: "NUDGE_RECEIVED" as const,
  title: "제목",
  body: "본문",
  todoId: 42,
  friendId: "friend-1",
};

describe("PublishDeduplicatedNotificationUseCase", () => {
  it("할 일 주인·날짜를 더한 알림을 중복 방지 발송에 넘긴다", async () => {
    // Given
    const sendNotificationWithDeduplication = { execute: vi.fn().mockResolvedValue(null) };
    const useCase = new PublishDeduplicatedNotificationUseCase({
      sendNotificationWithDeduplication,
      todoTargetReader: {
        findTodoTargets: async () => new Map([[42, { ownerId: "owner-1", date: "2026-10-27" }]]),
      },
    });

    // When
    await useCase.execute(nudge);

    // Then
    expect(sendNotificationWithDeduplication.execute).toHaveBeenCalledWith({
      ...nudge,
      metadata: { todoOwnerId: "owner-1", todoDate: "2026-10-27" },
    });
  });
});

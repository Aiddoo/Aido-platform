import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";

import { PublishNotificationUseCase } from "./publish-notification.use-case.js";

const comment = {
  userId: "user-1",
  type: "TODO_SHARED" as const,
  title: "제목",
  body: "본문",
  todoId: 42,
  metadata: { commentId: "comment-1" },
};

describe("PublishNotificationUseCase", () => {
  it("할 일 주인·날짜를 더한 알림을 단건 발송에 넘긴다", async () => {
    // Given
    const sent = new RecordingNotificationPublisher();
    const useCase = new PublishNotificationUseCase({
      sendNotification: sent.single,
      todoTargetReader: {
        findTodoTargets: async () =>
          new Map([[42, { ownerId: UserId.reconstitute("owner-1"), date: "2026-10-27" }]]),
      },
    });

    // When
    await useCase.execute(comment);

    // Then
    expect(sent.published).toEqual([
      {
        mode: "single",
        data: {
          ...comment,
          metadata: { commentId: "comment-1", todoOwnerId: "owner-1", todoDate: "2026-10-27" },
        },
      },
    ]);
  });
});

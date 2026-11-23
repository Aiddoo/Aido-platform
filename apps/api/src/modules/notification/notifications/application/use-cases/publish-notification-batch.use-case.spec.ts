import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";

import { PublishNotificationBatchUseCase } from "./publish-notification-batch.use-case.js";

const notice = {
  userId: "user-1",
  type: "SYSTEM_NOTICE" as const,
  title: "제목",
  body: "본문",
};
const shared = { ...notice, type: "TODO_SHARED" as const, todoId: 42 };

function createUseCase() {
  const sent = new RecordingNotificationPublisher();
  const useCase = new PublishNotificationBatchUseCase({
    sendBatchNotification: sent.batch,
    todoTargetReader: {
      findTodoTargets: async () =>
        new Map([[42, { ownerId: UserId.reconstitute("owner-1"), date: "2026-10-27" }]]),
    },
  });
  return { useCase, sent };
}

describe("PublishNotificationBatchUseCase", () => {
  it("옵션 없이 부르면 빈 옵션으로 할 일 주인·날짜를 더한 묶음을 넘긴다", async () => {
    // Given
    const { useCase, sent } = createUseCase();

    // When
    const result = await useCase.execute([notice, shared]);

    // Then
    expect(result).toEqual({ count: 2 });
    expect(sent.published.map(({ data }) => data)).toEqual([
      notice,
      { ...shared, metadata: { todoOwnerId: "owner-1", todoDate: "2026-10-27" } },
    ]);
    expect(sent.batchOptions).toEqual([{}]);
  });

  it("받은 옵션을 그대로 넘긴다", async () => {
    // Given
    const { useCase, sent } = createUseCase();

    // When
    await useCase.execute([notice], { deliveryMode: "SINGLE" });

    // Then
    expect(sent.published.map(({ data }) => data)).toEqual([notice]);
    expect(sent.batchOptions).toEqual([{ deliveryMode: "SINGLE" }]);
  });
});

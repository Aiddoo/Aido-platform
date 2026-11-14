import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { SendMilestoneNotificationUseCase } from "./send-milestone-notification.use-case.js";

const MILESTONE_LOCK_KEY = "mutation:v1:notification:milestone:u1:COUNT_10";

function setup(history = new InMemoryNotificationRepository()) {
  const notificationPublisher = new RecordingNotificationPublisher();
  const mutationLock = new RecordingMutationLock();
  const useCase = new SendMilestoneNotificationUseCase({
    notificationPublisher,
    recipientLocaleReader: { getLocale: async () => "ko" },
    notificationHistoryReader: history,
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    logger: new SilentLogger(),
  });
  return { useCase, notificationPublisher, mutationLock };
}

describe("SendMilestoneNotificationUseCase — 달성 마일스톤 알림", () => {
  it("milestone 잠금을 잡고 한 번 발송한다", async () => {
    // Given
    const { useCase, notificationPublisher, mutationLock } = setup();

    // When
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    expect(mutationLock.acquiredKeys).toEqual([[MILESTONE_LOCK_KEY]]);
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publish",
        data: expect.objectContaining({
          userId: "u1",
          type: "WEEKLY_ACHIEVEMENT",
          metadata: { milestone: "COUNT_10" },
        }),
      },
    ]);
  });

  it("같은 마일스톤 알림을 이미 보냈으면 건너뛴다", async () => {
    // Given
    const history = new InMemoryNotificationRepository([
      createInboxNotificationFixture({
        userId: "u1",
        type: "WEEKLY_ACHIEVEMENT",
        metadata: { milestone: "COUNT_10" },
      }),
    ]);
    const { useCase, notificationPublisher } = setup(history);

    // When
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    expect(notificationPublisher.published).toEqual([]);
  });

  it("발송이 실패하면 작업이 재시도하도록 오류를 그대로 던진다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();
    notificationPublisher.failWith = new Error("temporary");

    // When
    const result = useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    await expect(result).rejects.toThrow("temporary");
  });
});

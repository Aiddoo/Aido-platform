import { InMemoryNotificationDedupLock } from "#test/doubles/notification/in-memory-notification-dedup-lock";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { SendMilestoneNotificationUseCase } from "./send-milestone-notification.use-case.js";

const MILESTONE_LOCK_KEY = "milestone:u1:COUNT_10";

function setup(history = new InMemoryNotificationRepository()) {
  const notificationPublisher = new RecordingNotificationPublisher();
  const notificationDedupLock = new InMemoryNotificationDedupLock();
  const useCase = new SendMilestoneNotificationUseCase({
    notificationPublisher,
    recipientLocaleReader: { getLocale: async () => "ko" },
    notificationHistoryReader: history,
    notificationDedupLock,
    logger: new SilentLogger(),
  });
  return { useCase, notificationPublisher, notificationDedupLock };
}

describe("SendMilestoneNotificationUseCase — 달성 마일스톤 알림", () => {
  it("milestone 잠금을 획득해 한 번 발송하고 잠금을 해제한다", async () => {
    // Given
    const { useCase, notificationPublisher, notificationDedupLock } = setup();

    // When
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    expect(notificationDedupLock.acquiredKeys).toEqual([MILESTONE_LOCK_KEY]);
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
    expect(notificationDedupLock.releasedKeys).toEqual([MILESTONE_LOCK_KEY]);
  });

  it("같은 마일스톤 알림을 이미 보냈으면 건너뛰고 잠금을 해제한다", async () => {
    // Given
    const history = new InMemoryNotificationRepository([
      createInboxNotificationFixture({
        userId: "u1",
        type: "WEEKLY_ACHIEVEMENT",
        metadata: { milestone: "COUNT_10" },
      }),
    ]);
    const { useCase, notificationPublisher, notificationDedupLock } = setup(history);

    // When
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    expect(notificationPublisher.published).toEqual([]);
    expect(notificationDedupLock.releasedKeys).toEqual([MILESTONE_LOCK_KEY]);
  });

  it("다른 실행이 잠금을 보유하면 중복 발송을 건너뛴다", async () => {
    // Given
    const { useCase, notificationPublisher, notificationDedupLock } = setup();
    notificationDedupLock.hold(MILESTONE_LOCK_KEY);

    // When
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    expect(notificationPublisher.published).toEqual([]);
    expect(notificationDedupLock.heldKeys).toEqual([MILESTONE_LOCK_KEY]);
  });

  it("발송 실패 시 runtime이 재시도할 수 있도록 잠금을 해제한다", async () => {
    // Given
    const { useCase, notificationPublisher, notificationDedupLock } = setup();
    notificationPublisher.failWith = new Error("temporary");

    // When
    const result = useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    // Then
    await expect(result).rejects.toThrow("temporary");
    expect(notificationDedupLock.releasedKeys).toEqual([MILESTONE_LOCK_KEY]);
    expect(notificationDedupLock.heldKeys).toEqual([]);
  });
});

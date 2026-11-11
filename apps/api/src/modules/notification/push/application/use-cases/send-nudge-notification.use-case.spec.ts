import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { SendNudgeNotificationUseCase } from "./send-nudge-notification.use-case.js";

function setup() {
  const notificationPublisher = new RecordingNotificationPublisher();
  const useCase = new SendNudgeNotificationUseCase({
    notificationPublisher,
    recipientLocaleReader: { getLocale: async () => "ko" },
    logger: new SilentLogger(),
  });
  return { useCase, notificationPublisher };
}

describe("SendNudgeNotificationUseCase — 콕 찌르기 알림", () => {
  it("할 일 넛지에 할 일 정보와 선택 메시지 메타데이터를 포함한다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();

    // When
    await useCase.execute({
      nudgeId: 3,
      senderId: "u1",
      receiverId: "u2",
      senderName: "민재",
      todoId: 7,
      todoTitle: "운동",
      message: "가보자고",
    });

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publishWithDeduplication",
        data: expect.objectContaining({
          userId: "u2",
          type: "NUDGE_RECEIVED",
          nudgeId: 3,
          friendId: "u1",
          todoId: 7,
          metadata: { message: "가보자고" },
          campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
        }),
      },
    ]);
  });

  it("todoId가 없으면 할 일 생성 넛지 경로를 사용한다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();

    // When
    await useCase.execute({ nudgeId: 4, senderId: "u1", receiverId: "u2", senderName: "민재" });

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publishWithDeduplication",
        data: expect.objectContaining({ todoId: undefined, metadata: undefined }),
      },
    ]);
  });
});

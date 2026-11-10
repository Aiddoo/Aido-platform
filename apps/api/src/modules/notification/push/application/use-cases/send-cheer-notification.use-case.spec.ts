import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { SendCheerNotificationUseCase } from "./send-cheer-notification.use-case.js";

describe("SendCheerNotificationUseCase — 응원 알림", () => {
  it("선택 메시지 메타데이터와 함께 CHEER_RECEIVED 알림을 보낸다", async () => {
    // Given
    const notificationPublisher = new RecordingNotificationPublisher();
    const useCase = new SendCheerNotificationUseCase({
      notificationPublisher,
      recipientLocaleReader: { getLocale: async () => "ko" },
      logger: new SilentLogger(),
    });

    // When
    await useCase.execute({
      cheerId: 2,
      senderId: "u1",
      receiverId: "u2",
      senderName: "지윤",
      message: "화이팅!",
    });

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publishWithDeduplication",
        data: expect.objectContaining({
          userId: "u2",
          type: "CHEER_RECEIVED",
          cheerId: 2,
          friendId: "u1",
          metadata: { senderId: "u1", senderName: "지윤", message: "화이팅!" },
          campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
        }),
      },
    ]);
  });
});

import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { SendFollowAcceptedNotificationUseCase } from "./send-follow-accepted-notification.use-case.js";

describe("SendFollowAcceptedNotificationUseCase — 친구 요청 수락 알림", () => {
  it("친구 요청을 수락한 사용자 정보와 함께 FOLLOW_ACCEPTED를 보낸다", async () => {
    // Given
    const notificationPublisher = new RecordingNotificationPublisher();
    const useCase = new SendFollowAcceptedNotificationUseCase({
      notificationPublisher,
      recipientLocaleReader: { getLocale: async () => "ko" },
      logger: new SilentLogger(),
    });

    // When
    await useCase.execute({ userId: "u1", friendId: "u2", friendName: "지윤" });

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publishWithDeduplication",
        data: expect.objectContaining({
          userId: "u1",
          type: "FOLLOW_ACCEPTED",
          friendId: "u2",
          campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
          variantId: expect.stringMatching(/^follow_accepted_v3\./),
        }),
      },
    ]);
  });
});

import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { SendFollowAcceptedNotificationUseCase } from "./send-follow-accepted-notification.use-case.js";

describe("SendFollowAcceptedNotificationUseCase", () => {
  it("친구 요청을 수락한 사용자 정보와 함께 FOLLOW_ACCEPTED를 보낸다", async () => {
    const sendFollowAcceptedNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendFollowAcceptedNotificationUseCase>[0]
    >({});
    const unit = new SendFollowAcceptedNotificationUseCase(
      sendFollowAcceptedNotificationDependencies,
    );
    const notificationSender: Mocked<
      ConstructorParameters<
        typeof SendFollowAcceptedNotificationUseCase
      >[0]["notificationPublisher"]
    > = sendFollowAcceptedNotificationDependencies.notificationPublisher;
    const recipientLocaleReader: Mocked<
      ConstructorParameters<
        typeof SendFollowAcceptedNotificationUseCase
      >[0]["recipientLocaleReader"]
    > = sendFollowAcceptedNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getLocale.mockResolvedValue("ko");

    await unit.execute({ userId: "u1", friendId: "u2", friendName: "지윤" });

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "FOLLOW_ACCEPTED",
        friendId: "u2",
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
        variantId: expect.stringMatching(/^follow_accepted_v3\./),
      }),
    );
  });
});

import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";
import { SendFollowAcceptedNotification } from "./send-follow-accepted-notification.use-case.js";

describe("SendFollowAcceptedNotification", () => {
  it("친구 요청을 수락한 사용자 정보와 함께 FOLLOW_ACCEPTED를 보낸다", async () => {
    const sendFollowAcceptedNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendFollowAcceptedNotification>[0]
    >({});
    const unit = new SendFollowAcceptedNotification(sendFollowAcceptedNotificationDependencies);
    const notificationSender: Mocked<NotificationPublisher> =
      sendFollowAcceptedNotificationDependencies.notificationPublisher;
    const recipientLocaleReader: Mocked<NotificationRecipientLocaleReader> =
      sendFollowAcceptedNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getRecipientLocale.mockResolvedValue("ko");

    await unit.execute({ userId: "u1", friendId: "u2", friendName: "지윤" });

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "FOLLOW_ACCEPTED",
        friendId: "u2",
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
        variantId: expect.stringMatching(/^follow_accepted_v1\./),
      }),
    );
  });
});

import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { SendCheerNotification } from "./send-cheer-notification.use-case.js";

describe("SendCheerNotification", () => {
  it("선택 메시지 메타데이터와 함께 CHEER_RECEIVED 알림을 보낸다", async () => {
    const sendCheerNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendCheerNotification>[0]
    >({});
    const unit = new SendCheerNotification(sendCheerNotificationDependencies);
    const notificationSender: Mocked<
      ConstructorParameters<typeof SendCheerNotification>[0]["notificationPublisher"]
    > = sendCheerNotificationDependencies.notificationPublisher;
    const recipientLocaleReader: Mocked<
      ConstructorParameters<typeof SendCheerNotification>[0]["recipientLocaleReader"]
    > = sendCheerNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getLocale.mockResolvedValue("ko");

    await unit.execute({
      cheerId: 2,
      senderId: "u1",
      receiverId: "u2",
      senderName: "지윤",
      message: "화이팅!",
    });

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        type: "CHEER_RECEIVED",
        cheerId: 2,
        friendId: "u1",
        metadata: { message: "화이팅!" },
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
      }),
    );
  });
});

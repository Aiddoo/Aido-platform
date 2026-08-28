import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";
import { SendCheerNotificationUseCase } from "./send-cheer-notification.use-case";

describe("SendCheerNotificationUseCase", () => {
	it("sends CHEER_RECEIVED with optional message metadata", async () => {
		const { unit, unitRef } = await TestBed.solitary(SendCheerNotificationUseCase).compile();
		const notificationSender: Mocked<NotificationPublisher> = unitRef.get(NotificationPublisher);
		const recipientLocaleReader: Mocked<NotificationRecipientLocaleReader> = unitRef.get(
			NotificationRecipientLocaleReader,
		);
		recipientLocaleReader.getRecipientLocale.mockResolvedValue("ko");

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

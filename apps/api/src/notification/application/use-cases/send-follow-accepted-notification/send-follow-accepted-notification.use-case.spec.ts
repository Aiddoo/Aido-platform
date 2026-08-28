import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";
import { SendFollowAcceptedNotificationUseCase } from "./send-follow-accepted-notification.use-case";

describe("SendFollowAcceptedNotificationUseCase", () => {
	it("sends FOLLOW_ACCEPTED with the actor identity", async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendFollowAcceptedNotificationUseCase,
		).compile();
		const notificationSender: Mocked<NotificationSender> = unitRef.get(NotificationSender);
		notificationSender.getUserLocale.mockResolvedValue("ko");

		await unit.execute({ userId: "u1", friendId: "u2", friendName: "지윤" });

		expect(notificationSender.createAndSendWithDedup).toHaveBeenCalledWith(
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

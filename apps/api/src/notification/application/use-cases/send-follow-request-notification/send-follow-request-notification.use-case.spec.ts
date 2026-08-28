import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { createFollowRequestNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";
import { SendFollowRequestNotificationUseCase } from "./send-follow-request-notification.use-case";

describe("SendFollowRequestNotificationUseCase", () => {
	let useCase: SendFollowRequestNotificationUseCase;
	let notificationSender: Mocked<NotificationSender>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendFollowRequestNotificationUseCase,
		).compile();
		useCase = unit;
		notificationSender = unitRef.get(NotificationSender);
		notificationSender.getUserLocale.mockResolvedValue("ko");
	});

	it("sends a deterministic deduplicated follow-request notification", async () => {
		const input = { followerId: "u1", followingId: "u2", followerName: "민재" };
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_REQUEST,
			recipientId: input.followingId,
			occurrenceKey: `${input.followerId}:${input.followingId}`,
		};
		const message = createFollowRequestNotificationMessage({
			senderName: input.followerName,
			locale: "ko",
			variantContext,
		});

		await useCase.execute(input);

		expect(notificationSender.createAndSendWithDedup).toHaveBeenCalledWith({
			userId: "u2",
			type: "FOLLOW_NEW",
			title: message.title,
			body: message.body,
			friendId: "u1",
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
	});

	it("propagates delivery failures for queue retry", async () => {
		notificationSender.createAndSendWithDedup.mockRejectedValue(new Error("temporary"));

		await expect(
			useCase.execute({ followerId: "u1", followingId: "u2", followerName: "민재" }),
		).rejects.toThrow("temporary");
	});
});

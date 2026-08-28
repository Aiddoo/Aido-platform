import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { createFollowRequestNotificationMessage } from "../../messages/notification-messages";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";
import { SendFollowRequestNotificationUseCase } from "./send-follow-request-notification.use-case";

describe("SendFollowRequestNotificationUseCase", () => {
	let useCase: SendFollowRequestNotificationUseCase;
	let notificationSender: Mocked<NotificationPublisher>;
	let recipientLocaleReader: Mocked<NotificationRecipientLocaleReader>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendFollowRequestNotificationUseCase,
		).compile();
		useCase = unit;
		notificationSender = unitRef.get(NotificationPublisher);
		recipientLocaleReader = unitRef.get(NotificationRecipientLocaleReader);
		recipientLocaleReader.getRecipientLocale.mockResolvedValue("ko");
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

		expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith({
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
		notificationSender.publishWithDeduplication.mockRejectedValue(new Error("temporary"));

		await expect(
			useCase.execute({ followerId: "u1", followingId: "u2", followerName: "민재" }),
		).rejects.toThrow("temporary");
	});
});

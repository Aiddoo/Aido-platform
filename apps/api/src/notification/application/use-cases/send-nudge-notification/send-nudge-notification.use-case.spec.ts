import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign.js";
import { NotificationPublisher } from "../../publishers/notification.publisher.js";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader.js";
import { SendNudgeNotificationUseCase } from "./send-nudge-notification.use-case.js";

describe("SendNudgeNotificationUseCase", () => {
	let useCase: SendNudgeNotificationUseCase;
	let notificationSender: Mocked<NotificationPublisher>;
	let recipientLocaleReader: Mocked<NotificationRecipientLocaleReader>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendNudgeNotificationUseCase).compile();
		useCase = unit;
		notificationSender = unitRef.get(NotificationPublisher);
		recipientLocaleReader = unitRef.get(NotificationRecipientLocaleReader);
		recipientLocaleReader.getRecipientLocale.mockResolvedValue("ko");
	});

	it("includes todo and optional message metadata for a todo nudge", async () => {
		await useCase.execute({
			nudgeId: 3,
			senderId: "u1",
			receiverId: "u2",
			senderName: "민재",
			todoId: 7,
			todoTitle: "운동",
			message: "가보자고",
		});

		expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "u2",
				type: "NUDGE_RECEIVED",
				nudgeId: 3,
				friendId: "u1",
				todoId: 7,
				metadata: { message: "가보자고" },
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
			}),
		);
	});

	it("uses the todo-creation nudge path when todoId is absent", async () => {
		await useCase.execute({
			nudgeId: 4,
			senderId: "u1",
			receiverId: "u2",
			senderName: "민재",
		});

		expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
			expect.objectContaining({ todoId: undefined, metadata: undefined }),
		);
	});
});

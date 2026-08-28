import { Inject, Injectable, Logger } from "@nestjs/common";

import { createMilestoneNotificationMessage } from "../../../domain/services/templates/notification-templates";
import type { NotificationMilestone } from "../../../domain/types/notification-milestone";
import {
	NOTIFICATION_DEDUP_LOCK,
	type NotificationDedupLockPort,
} from "../../ports/notification-dedup.port";
import {
	NOTIFICATION_HISTORY_READER,
	type NotificationHistoryReaderPort,
} from "../../ports/notification-history.reader.port";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendMilestoneNotificationInput {
	readonly userId: string;
	readonly milestone: NotificationMilestone;
}

@Injectable()
export class SendMilestoneNotificationUseCase {
	readonly #logger = new Logger(SendMilestoneNotificationUseCase.name);

	constructor(
		private readonly notificationSender: NotificationSender,
		@Inject(NOTIFICATION_HISTORY_READER)
		private readonly notificationHistoryReader: NotificationHistoryReaderPort,
		@Inject(NOTIFICATION_DEDUP_LOCK)
		private readonly notificationDedupLock: NotificationDedupLockPort,
	) {}

	async execute(input: SendMilestoneNotificationInput): Promise<void> {
		const release = await this.notificationDedupLock.acquire(
			`milestone:${input.userId}:${input.milestone}`,
		);
		if (release === null) {
			this.#logger.debug(
				`Milestone notification is already being handled: userId=${input.userId}, milestone=${input.milestone}`,
			);
			return;
		}

		try {
			const alreadySent = await this.notificationHistoryReader.hasMilestoneNotification(
				input.userId,
				input.milestone,
			);
			if (alreadySent) {
				this.#logger.debug(
					`Milestone already achieved: userId=${input.userId}, milestone=${input.milestone}`,
				);
				return;
			}

			const locale = await this.notificationSender.getUserLocale(input.userId);
			const message = createMilestoneNotificationMessage({
				milestone: input.milestone,
				locale,
			});
			await this.notificationSender.createAndSend({
				userId: input.userId,
				type: "WEEKLY_ACHIEVEMENT",
				title: message.title,
				body: message.body,
				metadata: { milestone: input.milestone },
			});
			this.#logger.log(
				`Milestone notification sent: userId=${input.userId}, milestone=${input.milestone}`,
			);
		} finally {
			await release();
		}
	}
}

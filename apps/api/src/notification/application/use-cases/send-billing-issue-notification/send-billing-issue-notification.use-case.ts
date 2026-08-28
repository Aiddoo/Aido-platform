import { Injectable, Logger } from "@nestjs/common";

import { createBillingIssueNotificationMessage } from "../../messages/notification-messages";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";

export interface SendBillingIssueNotificationInput {
	readonly userId: string;
}

@Injectable()
export class SendBillingIssueNotificationUseCase {
	readonly #logger = new Logger(SendBillingIssueNotificationUseCase.name);

	constructor(
		private readonly notificationPublisher: NotificationPublisher,
		private readonly recipientLocaleReader: NotificationRecipientLocaleReader,
	) {}

	async execute(input: SendBillingIssueNotificationInput): Promise<void> {
		const locale = await this.recipientLocaleReader.getRecipientLocale(input.userId);
		const message = createBillingIssueNotificationMessage({ locale });
		await this.notificationPublisher.publish({
			userId: input.userId,
			type: "SYSTEM_NOTICE",
			title: message.title,
			body: message.body,
		});
		this.#logger.log(`Billing issue notification sent: userId=${input.userId}`);
	}
}

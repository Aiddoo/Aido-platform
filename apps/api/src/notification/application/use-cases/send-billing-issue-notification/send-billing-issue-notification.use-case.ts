import { Injectable, Logger } from "@nestjs/common";

import { createBillingIssueNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendBillingIssueNotificationInput {
	readonly userId: string;
}

@Injectable()
export class SendBillingIssueNotificationUseCase {
	readonly #logger = new Logger(SendBillingIssueNotificationUseCase.name);

	constructor(private readonly notificationSender: NotificationSender) {}

	async execute(input: SendBillingIssueNotificationInput): Promise<void> {
		const locale = await this.notificationSender.getUserLocale(input.userId);
		const message = createBillingIssueNotificationMessage({ locale });
		await this.notificationSender.createAndSend({
			userId: input.userId,
			type: "SYSTEM_NOTICE",
			title: message.title,
			body: message.body,
		});
		this.#logger.log(`Billing issue notification sent: userId=${input.userId}`);
	}
}

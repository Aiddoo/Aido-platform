import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { createBillingIssueNotificationMessage } from "../../messages/delivery/notification-messages.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendBillingIssueNotificationInput {
  readonly userId: string;
}

interface SendBillingIssueNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly logger: ApplicationLogger;
}

export class SendBillingIssueNotification {
  readonly #dependencies: SendBillingIssueNotificationDependencies;

  constructor(dependencies: SendBillingIssueNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendBillingIssueNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(input.userId);
    const message = createBillingIssueNotificationMessage({ locale });
    await this.#dependencies.notificationPublisher.publish({
      userId: input.userId,
      type: "SYSTEM_NOTICE",
      title: message.title,
      body: message.body,
    });
    this.#dependencies.logger.log(`Billing issue notification sent: userId=${input.userId}`);
  }
}

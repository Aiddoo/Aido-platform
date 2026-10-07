import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { createBillingIssueNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type { NotificationRecipientLocaleReaderPort } from "../../ports/delivery/notification-recipient-locale.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

export interface SendBillingIssueNotificationInput {
  readonly userId: string;
}

interface SendBillingIssueNotificationDependencies {
  readonly notificationPublisher: Pick<NotificationPublisher, "publish">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class SendBillingIssueNotification {
  readonly #dependencies: SendBillingIssueNotificationDependencies;

  constructor(dependencies: SendBillingIssueNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendBillingIssueNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(input.userId);
    const message = createBillingIssueNotificationMessage({ locale });
    await this.#dependencies.notificationPublisher.publish({
      userId: input.userId,
      type: "SYSTEM_NOTICE",
      title: message.title,
      body: message.body,
    });
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_BILLING_ISSUE_NOTIFICATION_SENT,
      userId: input.userId,
    });
  }
}

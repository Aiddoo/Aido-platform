import { NOTICE_DEEP_LINK_PATH } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { createBillingIssueNotificationMessage } from "../messages/system-notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

export interface SendBillingIssueNotificationInput {
  readonly userId: string;
}

interface SendBillingIssueNotificationDependencies {
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publish">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendBillingIssueNotificationUseCase {
  readonly #dependencies: SendBillingIssueNotificationDependencies;

  constructor(dependencies: SendBillingIssueNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendBillingIssueNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(
      UserId.reconstitute(input.userId),
    );
    const message = createBillingIssueNotificationMessage({ locale });
    await this.#dependencies.notificationPublisher.publish({
      userId: input.userId,
      type: "SYSTEM_NOTICE",
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      action: { type: "DEEP_LINK", url: NOTICE_DEEP_LINK_PATH.SUBSCRIPTION },
    });
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_BILLING_ISSUE_NOTIFICATION_SENT,
      userId: input.userId,
    });
  }
}

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { NotificationMilestone } from "../../../domain/types/delivery/notification-milestone.js";
import { createMilestoneNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationDedupLockPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import type { NotificationRecipientLocaleReaderPort } from "../../ports/delivery/notification-recipient-locale.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

export interface SendMilestoneNotificationInput {
  readonly userId: string;
  readonly milestone: NotificationMilestone;
}

interface SendMilestoneNotificationDependencies {
  readonly notificationPublisher: Pick<NotificationPublisher, "publish">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "hasMilestoneNotification"
  >;
  readonly notificationDedupLock: Pick<NotificationDedupLockPort, "acquire">;
  readonly logger: Pick<ApplicationLogger, "debug" | "log">;
}

export class SendMilestoneNotification {
  readonly #dependencies: SendMilestoneNotificationDependencies;

  constructor(dependencies: SendMilestoneNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendMilestoneNotificationInput): Promise<void> {
    const release = await this.#dependencies.notificationDedupLock.acquire(
      `milestone:${input.userId}:${input.milestone}`,
    );
    if (release === null) {
      this.#dependencies.logger.debug({
        event: NotificationDeliveryLogEvent.SEND_MILESTONE_NOTIFICATION_LOCK_BUSY,
        userId: input.userId,
      });
      return;
    }

    try {
      const alreadySent =
        await this.#dependencies.notificationHistoryReader.hasMilestoneNotification(
          input.userId,
          input.milestone,
        );
      if (alreadySent) {
        this.#dependencies.logger.debug({
          event: NotificationDeliveryLogEvent.SEND_MILESTONE_NOTIFICATION_DUPLICATE_SKIPPED,
          userId: input.userId,
        });
        return;
      }

      const locale = await this.#dependencies.recipientLocaleReader.getLocale(input.userId);
      const message = createMilestoneNotificationMessage({
        milestone: input.milestone,
        locale,
      });
      await this.#dependencies.notificationPublisher.publish({
        userId: input.userId,
        type: "WEEKLY_ACHIEVEMENT",
        title: message.title,
        body: message.body,
        metadata: { milestone: input.milestone },
      });
      this.#dependencies.logger.log({
        event: NotificationDeliveryLogEvent.SEND_MILESTONE_NOTIFICATION_SENT,
        userId: input.userId,
      });
    } finally {
      await release();
    }
  }
}

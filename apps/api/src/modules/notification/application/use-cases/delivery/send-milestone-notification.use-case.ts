import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { NotificationMilestone } from "../../../domain/types/delivery/notification-milestone.js";
import { createMilestoneNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { type NotificationDedupLockPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendMilestoneNotificationInput {
  readonly userId: string;
  readonly milestone: NotificationMilestone;
}

interface SendMilestoneNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly notificationHistoryReader: NotificationHistoryReaderPort;
  readonly notificationDedupLock: NotificationDedupLockPort;
  readonly logger: ApplicationLogger;
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
      this.#dependencies.logger.debug(
        `Milestone notification is already being handled: userId=${input.userId}, milestone=${input.milestone}`,
      );
      return;
    }

    try {
      const alreadySent =
        await this.#dependencies.notificationHistoryReader.hasMilestoneNotification(
          input.userId,
          input.milestone,
        );
      if (alreadySent) {
        this.#dependencies.logger.debug(
          `Milestone already achieved: userId=${input.userId}, milestone=${input.milestone}`,
        );
        return;
      }

      const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(
        input.userId,
      );
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
      this.#dependencies.logger.log(
        `Milestone notification sent: userId=${input.userId}, milestone=${input.milestone}`,
      );
    } finally {
      await release();
    }
  }
}

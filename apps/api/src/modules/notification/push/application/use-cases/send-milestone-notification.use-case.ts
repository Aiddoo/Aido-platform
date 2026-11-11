import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type NotificationHistoryReaderPort } from "../../../inbox/application/ports/notification-history.reader.port.js";
import type { NotificationMilestone } from "../../domain/notification-milestone.constants.js";
import { createMilestoneNotificationMessage } from "../messages/system-notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type NotificationDedupLockPort } from "../ports/notification-dedup.port.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

export interface SendMilestoneNotificationInput {
  readonly userId: string;
  readonly milestone: NotificationMilestone;
}

interface SendMilestoneNotificationDependencies {
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publish">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "hasMilestoneNotification"
  >;
  readonly notificationDedupLock: Pick<NotificationDedupLockPort, "acquire">;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "log">;
}

export class SendMilestoneNotificationUseCase {
  readonly #dependencies: SendMilestoneNotificationDependencies;

  constructor(dependencies: SendMilestoneNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendMilestoneNotificationInput): Promise<void> {
    const release = await this.#dependencies.notificationDedupLock.acquire(
      `milestone:${input.userId}:${input.milestone}`,
    );
    if (release == null) {
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

      const locale = await this.#dependencies.recipientLocaleReader.getLocale(
        UserId.reconstitute(input.userId),
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
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
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

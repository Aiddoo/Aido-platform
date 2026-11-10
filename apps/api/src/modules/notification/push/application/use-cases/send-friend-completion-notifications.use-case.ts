import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import { DuplicateNotificationError } from "../../../inbox/application/ports/notification.repository.port.js";
import { resolveRecipientLocale } from "../../domain/recipient-locale.domain-service.js";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { createFriendCompletedNotificationMessage } from "../messages/notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type UserNotificationSettingsPort } from "../ports/user-notification-settings.port.js";
import type { PersistedBatchNotificationResult } from "../read-models/push-delivery.read-model.js";
import type { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";

export interface SendFriendCompletionNotificationsInput {
  readonly friendId: string;
  readonly friendName: string;
  readonly notifyUserIds: string[];
  readonly timezone: string;
}

interface SendFriendCompletionNotificationsDependencies {
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly persistBatch: Pick<PersistBatchNotificationUseCase, "execute">;
  readonly finalizeBatch: Pick<FinalizeBatchNotificationUseCase, "execute">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly userNotificationSettings: Pick<
    UserNotificationSettingsPort,
    "getPreferenceRecordsByUserIds"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "log">;
}

export class SendFriendCompletionNotificationsUseCase {
  readonly #dependencies: SendFriendCompletionNotificationsDependencies;

  constructor(dependencies: SendFriendCompletionNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendCompletionNotificationsInput): Promise<void> {
    if (input.notifyUserIds.length === 0) {
      this.#dependencies.logger.debug({
        event: NotificationDeliveryLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_NO_RECIPIENTS,
      });
      return;
    }

    const notificationDate = localDateIn(this.#dependencies.clock.now(), input.timezone);
    const localDate = notificationDate.toString();
    const alreadyNotifiedUserIds =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: input.notifyUserIds,
        type: "FRIEND_COMPLETED",
        notificationDate,
        friendId: input.friendId,
      });
    const recipientUserIds = input.notifyUserIds.filter(
      (userId) => !alreadyNotifiedUserIds.has(userId),
    );

    if (recipientUserIds.length === 0) {
      this.#dependencies.logger.debug({
        event: NotificationDeliveryLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_ALREADY_SENT,
        friendId: input.friendId,
      });
      return;
    }

    const preferences =
      await this.#dependencies.userNotificationSettings.getPreferenceRecordsByUserIds(
        recipientUserIds.map((userId) => UserId.reconstitute(userId)),
      );
    const storedLocaleByUserId = new Map(
      preferences.map((preference) => [preference.userId, preference.locale]),
    );
    const notifications = recipientUserIds.map((userId) => {
      const variantContext = {
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
        recipientId: userId,
        occurrenceKey: `${input.friendId}:${localDate}`,
      };
      const message = createFriendCompletedNotificationMessage({
        friendName: input.friendName,
        locale: resolveRecipientLocale({
          storedLocale: storedLocaleByUserId.get(userId) ?? null,
          lastRequestLocale: null,
        }),
        variantContext,
      });
      return {
        userId,
        type: "FRIEND_COMPLETED" as const,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        friendId: input.friendId,
        notificationDate,
        campaignKey: variantContext.campaignKey,
        variantId: message.variantId,
      };
    });
    let persistedBatch: PersistedBatchNotificationResult;
    try {
      persistedBatch = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.persistBatch.execute(notifications),
      );
    } catch (error) {
      if (!(error instanceof DuplicateNotificationError)) {
        throw error;
      }
      this.#dependencies.logger.debug({
        event:
          NotificationDeliveryLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_DUPLICATE_PREVENTED,
        friendId: input.friendId,
      });
      return;
    }

    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_PERSISTED,
      friendId: input.friendId,
      count: persistedBatch.count,
    });
    await this.#dependencies.finalizeBatch.execute(persistedBatch);
    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_EFFECTS_FINALIZED,
      friendId: input.friendId,
      count: persistedBatch.count,
    });
  }
}

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, toSupportedLocale } from "#api/shared/domain/locale";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createFriendCompletedNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { DuplicateNotificationError } from "../../ports/delivery/notification.repository.port.js";
import { type UserNotificationSettingsPort } from "../../ports/delivery/user-notification-settings.port.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { PersistedBatchNotificationResult } from "../../types/delivery/push-delivery.types.js";
import type { FinalizeBatchNotification } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotification } from "./persist-batch-notification.use-case.js";

export interface SendFriendCompletionNotificationsInput {
  readonly friendId: string;
  readonly friendName: string;
  readonly notifyUserIds: string[];
  readonly timezone: string;
}

interface SendFriendCompletionNotificationsDependencies {
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly persistBatch: PersistBatchNotification;
  readonly finalizeBatch: FinalizeBatchNotification;
  readonly unitOfWork: UnitOfWorkPort;
  readonly userNotificationSettings: UserNotificationSettingsPort;
  readonly logger: ApplicationLogger;
}

export class SendFriendCompletionNotifications {
  readonly #dependencies: SendFriendCompletionNotificationsDependencies;

  constructor(dependencies: SendFriendCompletionNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendCompletionNotificationsInput): Promise<void> {
    if (input.notifyUserIds.length === 0) {
      this.#dependencies.logger.debug("No friends to notify for friend completion");
      return;
    }

    const notificationDate = todayInTimezone(input.timezone);
    const localDate = notificationDate.toISOString().slice(0, 10);
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
      this.#dependencies.logger.debug(
        `Friend completion already sent today: friendId=${input.friendId}`,
      );
      return;
    }

    const preferences =
      await this.#dependencies.userNotificationSettings.getPreferenceRecordsByUserIds(
        recipientUserIds,
      );
    const localeByUserId = new Map(
      preferences.map((preference) => [preference.userId, toSupportedLocale(preference.locale)]),
    );
    const notifications = recipientUserIds.map((userId) => {
      const variantContext = {
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
        recipientId: userId,
        occurrenceKey: `${input.friendId}:${localDate}`,
      };
      const message = createFriendCompletedNotificationMessage({
        friendName: input.friendName,
        locale: localeByUserId.get(userId) ?? DEFAULT_LOCALE,
        variantContext,
      });
      return {
        userId,
        type: "FRIEND_COMPLETED" as const,
        title: message.title,
        body: message.body,
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
      if (!(error instanceof DuplicateNotificationError)) throw error;
      this.#dependencies.logger.debug(
        `Friend completion duplicate prevented by constraint: friendId=${input.friendId}`,
      );
      return;
    }

    this.#dependencies.logger.log(
      `Friend completion notifications persisted: friendId=${input.friendId}, count=${persistedBatch.count}`,
    );
    await this.#dependencies.finalizeBatch.execute(persistedBatch);
    this.#dependencies.logger.debug(
      `Friend completion post-commit effects finalized: friendId=${input.friendId}, count=${persistedBatch.count}`,
    );
  }
}

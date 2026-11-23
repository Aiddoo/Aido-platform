import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import type { PersistedBatchNotificationResultReadModel } from "../../../push-dispatches/notification-push-dispatches.public.js";
import { createFriendCompletedNotificationMessage } from "../../../shared/application/messages/social-notification.messages.js";
import { type UserNotificationSettingsPort } from "../../../shared/application/ports/user-notification-settings.port.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../shared/domain/transactional-notification-campaign.constants.js";
import { DuplicateNotificationError } from "../notifications.errors.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import type { NotificationHistoryReaderPort } from "../ports/notification-history.reader.port.js";
import type { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";

export interface SendFriendCompletionNotificationsInput {
  readonly friendId: string;
  readonly friendName: string;
  readonly notifyUserIds: string[];
  readonly timezone: string;
}

interface SendFriendCompletionNotificationsDependencies {
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "listAlreadyNotifiedUserIds"
  >;
  readonly persistBatch: Pick<PersistBatchNotificationUseCase, "execute">;
  readonly finalizeBatch: Pick<FinalizeBatchNotificationUseCase, "execute">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly userNotificationSettings: Pick<
    UserNotificationSettingsPort,
    "listPreferenceReadModelsByUserIds"
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
        event: NotificationLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_NO_RECIPIENTS,
      });
      return;
    }

    const notificationDate = localDateIn(this.#dependencies.clock.now(), input.timezone);
    const alreadyNotifiedUserIds =
      await this.#dependencies.notificationHistoryReader.listAlreadyNotifiedUserIds({
        userIds: input.notifyUserIds.map((userId) => UserId.reconstitute(userId)),
        type: "FRIEND_COMPLETED",
        notificationDate,
        friendId: UserId.reconstitute(input.friendId),
      });
    const recipientUserIds = input.notifyUserIds.filter(
      (userId) => !alreadyNotifiedUserIds.has(userId),
    );

    if (recipientUserIds.length === 0) {
      this.#dependencies.logger.debug({
        event: NotificationLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_ALREADY_SENT,
        friendId: input.friendId,
      });
      return;
    }

    const notifications = await this.#buildNotifications(input, {
      recipientUserIds,
      notificationDate,
    });
    const persistedBatch = await this.#persist(input, notifications);
    if (persistedBatch == null) {
      return;
    }

    this.#dependencies.logger.log({
      event: NotificationLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_PERSISTED,
      friendId: input.friendId,
      count: persistedBatch.count,
    });
    await this.#dependencies.finalizeBatch.execute(persistedBatch);
    this.#dependencies.logger.debug({
      event: NotificationLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_EFFECTS_FINALIZED,
      friendId: input.friendId,
      count: persistedBatch.count,
    });
  }

  async #buildNotifications(
    input: SendFriendCompletionNotificationsInput,
    target: {
      readonly recipientUserIds: readonly string[];
      readonly notificationDate: Temporal.PlainDate;
    },
  ): Promise<CreateNotificationData[]> {
    const preferences =
      await this.#dependencies.userNotificationSettings.listPreferenceReadModelsByUserIds(
        target.recipientUserIds.map((userId) => UserId.reconstitute(userId)),
      );
    const storedLocaleByUserId = new Map(
      preferences.map((preference) => [preference.userId.value, preference.locale]),
    );
    return target.recipientUserIds.map((userId) => {
      const variantContext = {
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
        recipientId: userId,
        occurrenceKey: `${input.friendId}:${target.notificationDate.toString()}`,
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
        notificationDate: target.notificationDate,
        campaignKey: variantContext.campaignKey,
        variantId: message.variantId,
      };
    });
  }

  // 같은 친구·날짜의 알림이 이미 저장됐으면(동시 실행) null이고 보내지 않는다
  async #persist(
    input: SendFriendCompletionNotificationsInput,
    notifications: CreateNotificationData[],
  ): Promise<PersistedBatchNotificationResultReadModel | null> {
    try {
      return await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.persistBatch.execute(notifications),
      );
    } catch (error) {
      if (!(error instanceof DuplicateNotificationError)) {
        throw error;
      }
      this.#dependencies.logger.debug({
        event: NotificationLogEvent.SEND_FRIEND_COMPLETION_NOTIFICATIONS_DUPLICATE_PREVENTED,
        friendId: input.friendId,
      });
      return null;
    }
  }
}

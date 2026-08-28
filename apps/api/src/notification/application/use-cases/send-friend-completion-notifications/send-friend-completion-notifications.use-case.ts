import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, toSupportedLocale } from "@/shared/domain/locale";

import { createFriendCompletedNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { DuplicateNotificationError } from "../../ports/notification.repository.port";
import type { PersistedBatchNotificationDispatch } from "../../ports/push-dispatcher.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";
import { NotificationSender } from "../../senders/notification.sender";
import { DispatchBatchNotificationUseCase } from "../dispatch-batch-notification/dispatch-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "../persist-batch-notification/persist-batch-notification.use-case";

export interface SendFriendCompletionNotificationsInput {
	readonly friendId: string;
	readonly friendName: string;
	readonly notifyUserIds: string[];
	readonly timezone: string;
}

@Injectable()
export class SendFriendCompletionNotificationsUseCase {
	readonly #logger = new Logger(SendFriendCompletionNotificationsUseCase.name);

	constructor(
		private readonly notificationSender: NotificationSender,
		private readonly persistBatch: PersistBatchNotificationUseCase,
		private readonly dispatchBatch: DispatchBatchNotificationUseCase,
		@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userNotificationSettings: UserNotificationSettingsPort,
	) {}

	async execute(input: SendFriendCompletionNotificationsInput): Promise<void> {
		if (input.notifyUserIds.length === 0) {
			this.#logger.debug("No friends to notify for friend completion");
			return;
		}

		const notificationDate = todayInTimezone(input.timezone);
		const localDate = notificationDate.toISOString().slice(0, 10);
		const alreadyNotifiedUserIds = await this.notificationSender.findAlreadyNotifiedUserIds({
			userIds: input.notifyUserIds,
			type: "FRIEND_COMPLETED",
			notificationDate,
			friendId: input.friendId,
		});
		const recipientUserIds = input.notifyUserIds.filter(
			(userId) => !alreadyNotifiedUserIds.has(userId),
		);

		if (recipientUserIds.length === 0) {
			this.#logger.debug(`Friend completion already sent today: friendId=${input.friendId}`);
			return;
		}

		const preferences =
			await this.userNotificationSettings.getPreferenceRecordsByUserIds(recipientUserIds);
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
		let persistedBatch: PersistedBatchNotificationDispatch;
		try {
			persistedBatch = await this.unitOfWork.run(() => this.persistBatch.execute(notifications));
		} catch (error) {
			if (!(error instanceof DuplicateNotificationError)) throw error;
			this.#logger.debug(
				`Friend completion duplicate prevented by constraint: friendId=${input.friendId}`,
			);
			return;
		}

		this.#logger.log(
			`Friend completion notifications persisted: friendId=${input.friendId}, count=${persistedBatch.count}`,
		);
		await this.dispatchBatch.execute(persistedBatch);
		this.#logger.debug(
			`Friend completion push delivery scheduled: friendId=${input.friendId}, count=${persistedBatch.count}`,
		);
	}
}

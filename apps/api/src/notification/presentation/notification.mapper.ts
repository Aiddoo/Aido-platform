import {
	type NotificationContext,
	type Notification as NotificationDto,
	type NotificationMetadata,
	notificationMetadataSchema,
} from "@aido/validators";

import { toISOString, toISOStringOrNull } from "@/shared/domain/date/utils/format";

import type { NotificationRecord } from "../domain/records/notification.record";

export abstract class NotificationMapper {
	static toDto(notification: NotificationRecord): NotificationDto {
		const context: NotificationContext = {};
		if (notification.todoId != null) {
			context.todoId = notification.todoId;
		}
		if (notification.friendId != null) {
			context.friendId = notification.friendId;
		}
		if (notification.nudgeId != null) {
			context.nudgeId = notification.nudgeId;
		}
		if (notification.cheerId != null) {
			context.cheerId = notification.cheerId;
		}
		const hasContext = Object.keys(context).length > 0;

		return {
			id: notification.id,
			userId: notification.userId,
			type: notification.type,
			title: notification.title,
			body: notification.body,
			isRead: notification.isRead,
			metadata: toNotificationMetadata(notification.metadata),
			...(hasContext && { context }),
			action: {
				type: notification.actionType,
				...(notification.actionUrl && { url: notification.actionUrl }),
			},
			createdAt: toISOString(notification.createdAt),
			readAt: toISOStringOrNull(notification.readAt ?? null),
		};
	}

	static toDtoList(notifications: NotificationRecord[]): NotificationDto[] {
		return notifications.map((notification) => this.toDto(notification));
	}
}

function toNotificationMetadata(metadata: unknown): NotificationMetadata {
	const result = notificationMetadataSchema.safeParse(metadata);

	return result.success ? result.data : null;
}

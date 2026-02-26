/**
 * Notification Mapper
 *
 * Prisma 엔티티를 DTO 형식으로 변환
 */

import type {
	NotificationContext,
	Notification as NotificationDto,
} from "@aido/validators";
import { toISOString, toISOStringOrNull } from "@/common/date";
import type { Notification } from "@/generated/prisma/client";

export abstract class NotificationMapper {
	/**
	 * Prisma Notification → Response DTO 형식
	 */
	static toDto(notification: Notification): NotificationDto {
		const context: NotificationContext = {};
		if (notification.todoId != null) context.todoId = notification.todoId;
		if (notification.friendId != null) context.friendId = notification.friendId;
		if (notification.nudgeId != null) context.nudgeId = notification.nudgeId;
		if (notification.cheerId != null) context.cheerId = notification.cheerId;
		const hasContext = Object.keys(context).length > 0;

		return {
			id: notification.id,
			userId: notification.userId,
			type: notification.type,
			title: notification.title,
			body: notification.body,
			isRead: notification.isRead,
			metadata: notification.metadata as Record<string, unknown> | null,
			...(hasContext && { context }),
			createdAt: toISOString(notification.createdAt),
			readAt: toISOStringOrNull(notification.readAt ?? null),
		};
	}

	/**
	 * Prisma Notification 배열 → Response DTO 배열
	 */
	static toDtoList(notifications: Notification[]): NotificationDto[] {
		return notifications.map((notification) => this.toDto(notification));
	}
}

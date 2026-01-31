/**
 * Notification Mapper
 *
 * Prisma 엔티티를 DTO 형식으로 변환
 */

import type { Notification as NotificationDto } from "@aido/validators";
import type { Notification } from "@/generated/prisma/client";

export class NotificationMapper {
	/**
	 * Prisma Notification → Response DTO 형식
	 */
	static toDto(notification: Notification): NotificationDto {
		return {
			id: notification.id,
			userId: notification.userId,
			type: notification.type,
			title: notification.title,
			body: notification.body,
			isRead: notification.isRead,
			route: notification.route,
			metadata: notification.metadata as Record<string, unknown> | null,
			createdAt: notification.createdAt.toISOString(),
			readAt: notification.readAt?.toISOString() ?? null,
		};
	}

	/**
	 * Prisma Notification 배열 → Response DTO 배열
	 */
	static toDtoList(notifications: Notification[]): NotificationDto[] {
		return notifications.map((notification) => this.toDto(notification));
	}
}

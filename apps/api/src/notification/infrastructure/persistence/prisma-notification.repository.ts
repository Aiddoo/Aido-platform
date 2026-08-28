import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { toInputJson } from "@/shared/infrastructure/database/json.util";
import { isUniqueConstraintViolation } from "@/shared/infrastructure/database/prisma-error.util";

import type { CreateNotificationData } from "../../application/ports/notification-data";
import {
	DuplicateNotificationError,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import type { NotificationRecord } from "../../domain/records/notification.record";

interface DeletedNotificationRecipientRow {
	userId: string;
}

@Injectable()
export class PrismaNotificationRepository implements NotificationRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async createNotification(data: CreateNotificationData): Promise<NotificationRecord> {
		try {
			return await this.client.notification.create({
				data: {
					userId: data.userId,
					type: data.type,
					title: data.title,
					body: data.body,
					todoId: data.todoId,
					friendId: data.friendId,
					nudgeId: data.nudgeId,
					cheerId: data.cheerId,
					metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
					notificationDate: data.notificationDate ?? undefined,
					actionType: data.action?.type ?? "DEEP_LINK",
					actionUrl: data.action?.url,
					campaignKey: data.campaignKey,
					variantId: data.variantId,
					purpose: data.purpose ?? "TRANSACTIONAL",
				},
			});
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				throw new DuplicateNotificationError();
			}
			throw error;
		}
	}

	async createManyNotificationsAndReturn(
		dataList: CreateNotificationData[],
	): Promise<NotificationRecord[]> {
		if (dataList.length === 0) return [];

		try {
			return await this.client.notification.createManyAndReturn({
				data: dataList.map((data) => ({
					userId: data.userId,
					type: data.type,
					title: data.title,
					body: data.body,
					todoId: data.todoId,
					friendId: data.friendId,
					nudgeId: data.nudgeId,
					cheerId: data.cheerId,
					metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
					notificationDate: data.notificationDate ?? undefined,
					actionType: data.action?.type ?? "DEEP_LINK",
					actionUrl: data.action?.url,
					campaignKey: data.campaignKey,
					variantId: data.variantId,
					purpose: data.purpose ?? "TRANSACTIONAL",
				})),
				skipDuplicates: true,
			});
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				throw new DuplicateNotificationError();
			}
			throw error;
		}
	}

	async markAsRead(id: number, userId: string): Promise<boolean> {
		const result = await this.client.notification.updateMany({
			where: { id, userId, isRead: false },
			data: { isRead: true, readAt: now() },
		});
		return result.count > 0;
	}

	async markAsOpened(id: number, userId: string): Promise<boolean> {
		const openedAt = now();
		const result = await this.client.notification.updateMany({
			where: { id, userId, openedAt: null },
			data: { openedAt, isRead: true, readAt: openedAt },
		});
		if (result.count > 0) {
			await this.client.pushDispatch.updateMany({
				where: { notificationId: id, userId, openedAt: null },
				data: { openedAt },
			});
		}
		return result.count > 0;
	}

	async markAllAsRead(userId: string): Promise<{ count: number }> {
		return this.client.notification.updateMany({
			where: { userId, isRead: false },
			data: { isRead: true, readAt: now() },
		});
	}

	async deleteNotificationsByActorId(
		actorId: string,
	): Promise<{ count: number; affectedUserIds: string[] }> {
		const deletedRows = await this.client.$queryRaw<DeletedNotificationRecipientRow[]>(Prisma.sql`
			DELETE FROM "Notification"
			WHERE "friendId" = ${actorId}
				OR "metadata" ->> 'senderId' = ${actorId}
			RETURNING "userId"
		`);

		return {
			count: deletedRows.length,
			affectedUserIds: [...new Set(deletedRows.map((row) => row.userId))],
		};
	}
}

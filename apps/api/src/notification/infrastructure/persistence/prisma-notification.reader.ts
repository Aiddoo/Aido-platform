import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { FindNotificationsParams } from "../../application/ports/notification-data";
import type {
	FindAlreadyNotifiedUserIdsQuery,
	NotificationHistoryReaderPort,
} from "../../application/ports/notification-history.reader.port";
import type { ExistsRecentNotificationQuery } from "../../application/ports/notification-history.reader.port";
import type { NotificationInboxReaderPort } from "../../application/ports/notification-inbox.reader.port";
import type { NotificationRecord } from "../../domain/records/notification.record";

@Injectable()
export class PrismaNotificationReader
	implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async findNotificationById(id: number): Promise<NotificationRecord | null> {
		return this.client.notification.findUnique({ where: { id } });
	}

	async findNotificationsByUser(params: FindNotificationsParams): Promise<NotificationRecord[]> {
		const { userId, cursor, size, unreadOnly, types } = params;

		return this.client.notification.findMany({
			where: {
				userId,
				...(unreadOnly && { isRead: false }),
				...(types && types.length > 0 && { type: { in: types } }),
			},
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	async countUnread(userId: string): Promise<number> {
		return this.client.notification.count({ where: { userId, isRead: false } });
	}

	async existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
		const where: Prisma.NotificationWhereInput = {
			userId: query.userId,
			type: query.type,
			createdAt: { gte: query.since },
		};
		if (query.friendId !== undefined) where.friendId = query.friendId;
		if (query.todoId !== undefined) where.todoId = query.todoId;
		if (query.nudgeId !== undefined) where.nudgeId = query.nudgeId;
		if (query.cheerId !== undefined) where.cheerId = query.cheerId;

		const count = await this.client.notification.count({ where });
		return count > 0;
	}

	async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
		const rows = await this.client.notification.findMany({
			where: {
				userId: { in: query.userIds },
				type: query.type,
				...(query.friendId && { friendId: query.friendId }),
				notificationDate: query.notificationDate,
			},
			select: { userId: true },
			distinct: ["userId"],
		});
		return new Set(rows.map((row) => row.userId));
	}
}

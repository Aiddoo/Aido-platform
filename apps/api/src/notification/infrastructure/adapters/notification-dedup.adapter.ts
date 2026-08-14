import { Inject, Injectable } from "@nestjs/common";

import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";

import type {
	NotificationDedupPort,
	NotificationDedupRecord,
} from "../../application/ports/notification-dedup.port";
import type { NotificationType } from "../../domain/types/notification-type";
import {
	NOTIFICATION_DEDUP_SENTINEL,
	NOTIFICATION_DEDUP_TTL_MS,
	notificationDedupKey,
} from "../cache/notification-dedup.keyspace";

@Injectable()
export class NotificationDedupAdapter implements NotificationDedupPort {
	constructor(
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void> {
		const groups = new Map<string, string[]>();
		for (const record of records) {
			const key = notificationDedupKey(record.type, record.notificationDate);
			const userIds = groups.get(key) ?? [];
			userIds.push(record.userId);
			groups.set(key, userIds);
		}

		await Promise.all(
			[...groups.entries()].map(([key, userIds]) =>
				this.dedupProvider.addMembers(
					key,
					[NOTIFICATION_DEDUP_SENTINEL, ...userIds],
					NOTIFICATION_DEDUP_TTL_MS,
				),
			),
		);
	}

	async readKnownRecipients(
		type: NotificationType,
		notificationDate: Date,
		userIds: readonly string[],
	): Promise<Set<string> | null> {
		const notifiedUsers = await this.dedupProvider.filterMembers(
			notificationDedupKey(type, notificationDate),
			[NOTIFICATION_DEDUP_SENTINEL, ...userIds],
		);
		if (!notifiedUsers.delete(NOTIFICATION_DEDUP_SENTINEL)) return null;
		return notifiedUsers;
	}

	warmRecipients(
		type: NotificationType,
		notificationDate: Date,
		userIds: readonly string[],
	): Promise<void> {
		return this.dedupProvider.addMembers(
			notificationDedupKey(type, notificationDate),
			[NOTIFICATION_DEDUP_SENTINEL, ...userIds],
			NOTIFICATION_DEDUP_TTL_MS,
		);
	}
}

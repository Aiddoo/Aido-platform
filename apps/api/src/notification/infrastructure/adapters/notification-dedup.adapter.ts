import { Inject, Injectable } from "@nestjs/common";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import type {
	NotificationDedupPort,
	NotificationDedupRecord,
} from "../../application/ports/notification-dedup.port";
import type { NotificationType } from "../../domain/types/notification-type";

@Injectable()
export class NotificationDedupAdapter implements NotificationDedupPort {
	constructor(
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void> {
		const groups = new Map<string, string[]>();
		for (const record of records) {
			const key = DedupKeys.notified(record.type, record.notificationDate);
			const userIds = groups.get(key) ?? [];
			userIds.push(record.userId);
			groups.set(key, userIds);
		}

		await Promise.all(
			[...groups.entries()].map(([key, userIds]) =>
				this.dedupProvider.addMembers(
					key,
					[DedupKeys.SENTINEL, ...userIds],
					DedupKeys.TTL.NOTIFIED,
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
			DedupKeys.notified(type, notificationDate),
			[DedupKeys.SENTINEL, ...userIds],
		);
		if (!notifiedUsers.delete(DedupKeys.SENTINEL)) return null;
		return notifiedUsers;
	}

	warmRecipients(
		type: NotificationType,
		notificationDate: Date,
		userIds: readonly string[],
	): Promise<void> {
		return this.dedupProvider.addMembers(
			DedupKeys.notified(type, notificationDate),
			[DedupKeys.SENTINEL, ...userIds],
			DedupKeys.TTL.NOTIFIED,
		);
	}
}

import { Inject, Injectable } from "@nestjs/common";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_INBOX_READER,
	type NotificationInboxReaderPort,
} from "../../ports/notification-inbox.reader.port";

/**
 * 읽지 않은 알림 수 조회 유스케이스 (2분 캐시).
 */
@Injectable()
export class GetUnreadCountUseCase {
	constructor(
		@Inject(NOTIFICATION_INBOX_READER)
		private readonly notificationInboxReader: NotificationInboxReaderPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(userId: string): Promise<number> {
		return this.cache.wrapUnreadCount(userId, () =>
			this.notificationInboxReader.countUnread(userId),
		);
	}
}

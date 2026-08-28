import { Inject, Injectable } from "@nestjs/common";

import type { NotificationType } from "../../../domain/types/notification-type";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import {
	NOTIFICATION_HISTORY_READER,
	type NotificationHistoryReaderPort,
} from "../../ports/notification-history.reader.port";

/**
 * 이미 알림을 받은 사용자 ID 목록 조회 유스케이스 (배치)
 *
 * Sentinel 기반 atomic cold-start 감지:
 * - 단일 SMISMEMBER 호출로 sentinel + userIds를 동시에 확인
 * - Sentinel 있음 = warm → Redis 결과 신뢰
 * - Sentinel 없음 = cold start → DB fallback + warm-up
 */
@Injectable()
export class FindAlreadyNotifiedUsersUseCase {
	constructor(
		@Inject(NOTIFICATION_DEDUP)
		private readonly notificationDedup: NotificationDedupPort,
		@Inject(NOTIFICATION_HISTORY_READER)
		private readonly notificationHistoryReader: NotificationHistoryReaderPort,
	) {}

	async execute(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		const knownRecipients = await this.notificationDedup.readKnownRecipients(
			params.type,
			params.notificationDate,
			params.userIds,
		);
		if (knownRecipients) {
			return knownRecipients;
		}

		// Cold start: DB fallback + Redis warm-up
		const fromDb = await this.notificationHistoryReader.findAlreadyNotifiedUserIds(params);

		void this.notificationDedup.warmRecipients(params.type, params.notificationDate, [...fromDb]);

		return fromDb;
	}
}

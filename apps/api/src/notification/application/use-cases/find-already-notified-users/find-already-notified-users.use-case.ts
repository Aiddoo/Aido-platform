import { Inject, Injectable } from "@nestjs/common";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import type { NotificationType } from "../../../domain/types/notification-type";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

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
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
	) {}

	async execute(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		const setKey = DedupKeys.notified(params.type, params.notificationDate);

		// 단일 SMISMEMBER: sentinel + userIds → atomic cold-start 감지
		const result = await this.dedupProvider.filterMembers(setKey, [
			DedupKeys.SENTINEL,
			...params.userIds,
		]);

		if (result.has(DedupKeys.SENTINEL)) {
			// Set이 warm 상태 → Redis 결과 신뢰
			result.delete(DedupKeys.SENTINEL);
			return result;
		}

		// Cold start: DB fallback + Redis warm-up
		const fromDb =
			await this.notificationRepository.findAlreadyNotifiedUserIds(params);

		void this.dedupProvider.addMembers(
			setKey,
			[DedupKeys.SENTINEL, ...[...fromDb]],
			DedupKeys.TTL.NOTIFIED,
		);

		return fromDb;
	}
}

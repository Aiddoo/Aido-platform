import { Inject, Injectable, Logger } from "@nestjs/common";
import { subtractMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import type { NotificationRecord } from "../../../domain/records/notification.record";
import {
	buildDedupContextFields,
	buildDedupKey,
	resolveDedupStrategy,
} from "../../../domain/services/notification-dedup";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	NOTIFICATION_DEDUP_LOCK,
	type NotificationDedupLockPort,
} from "../../ports/notification-dedup.port";
import { SendNotificationUseCase } from "../send-notification/send-notification.use-case";

/**
 * 중복 방지가 적용된 알림 생성 및 푸시 발송 유스케이스.
 *
 * Race Condition 방지: ILockProvider 기반 잠금으로
 * 같은 (userId, type, contextKeys) 조합의 동시 요청을 직렬화한다.
 *
 * @returns 생성된 Notification 또는 null (중복 스킵 / 잠금 대기 스킵)
 */
@Injectable()
export class SendNotificationWithDedupUseCase {
	readonly #logger = new Logger(SendNotificationWithDedupUseCase.name);

	constructor(
		private readonly sendNotification: SendNotificationUseCase,
		@Inject(NOTIFICATION_DEDUP_LOCK)
		private readonly dedupLock: NotificationDedupLockPort,
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
	) {}

	async execute(
		data: CreateNotificationData,
	): Promise<NotificationRecord | null> {
		const strategy = resolveDedupStrategy(data.type);

		if (!strategy) {
			return this.sendNotification.execute(data);
		}

		const dedupKey = buildDedupKey(data, strategy);
		const release = await this.dedupLock.acquire(dedupKey);

		if (!release) {
			this.#logger.debug(
				`Notification dedup: lock busy for ${data.type}, userId=${data.userId}`,
			);
			return null;
		}

		try {
			const since = subtractMilliseconds(strategy.windowMs);
			const contextFields = buildDedupContextFields(data, strategy);
			const params = {
				userId: data.userId,
				type: data.type,
				since,
				...contextFields,
			};

			const exists =
				await this.notificationRepository.existsRecentNotification(params);
			if (exists) {
				this.#logger.debug(
					`Notification dedup: skipped ${data.type} for userId=${data.userId}`,
				);
				return null;
			}

			return await this.sendNotification.execute(data);
		} finally {
			await release();
		}
	}
}

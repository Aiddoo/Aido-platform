import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { CreateNotificationData } from "../../ports/notification-data.js";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port.js";
import {
	PUSH_DISPATCH_STAGING,
	type PushDispatchStagingRepositoryPort,
} from "../../ports/push-dispatch-staging.repository.port.js";
import { PushDeliveryAfterCommitPublisher } from "../../services/push-delivery-after-commit.publisher.js";
import type { PersistedBatchNotificationResult } from "../../types/push-delivery.types.js";

/**
 * 배치 알림과 push dispatch outbox를 원자 저장하고 후속 cache/dedup용 결과를 반환한다.
 *
 * push 발행은 after-commit으로 등록하고 cache·Redis dedup 정리는 호출자에게 분리한다.
 */
@Injectable()
export class PersistBatchNotificationUseCase {
	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_DISPATCH_STAGING)
		private readonly pushDispatchStaging: PushDispatchStagingRepositoryPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
		private readonly afterCommitPublisher: PushDeliveryAfterCommitPublisher,
	) {}

	async execute(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
		if (dataList.length === 0) {
			return { count: 0, sourceData: [] };
		}

		return this.uow.run(() => this.#persist(dataList));
	}

	async #persist(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
		const created = await this.notificationRepository.createManyNotificationsAndReturn(dataList);
		const forceKey = (userId: string, type: string): string => `${userId}\u0000${type}`;
		const forcedKeys = new Set(
			dataList
				.filter((data) => data.force === true)
				.map((data) => forceKey(data.userId, data.type)),
		);

		const staged = await this.pushDispatchStaging.stageMany(
			created.map((notification) => ({
				notificationId: notification.id,
				userId: notification.userId,
				purpose: notification.purpose,
				campaignKey: notification.campaignKey,
				variantId: notification.variantId,
				deliveryMode: "BATCH",
				force: forcedKeys.has(forceKey(notification.userId, notification.type)),
			})),
		);
		this.afterCommitPublisher.register(staged.map((dispatch) => dispatch.dispatchId));
		return { count: created.length, sourceData: dataList };
	}
}

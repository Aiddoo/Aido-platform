import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTaskRegistryPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";

import type { NotificationRecord } from "../../../domain/records/notification.record";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	DuplicateNotificationError,
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	PUSH_DISPATCH_STAGING,
	type PushDispatchStagingRepositoryPort,
} from "../../ports/push-dispatch-staging.repository.port";
import { PushDeliveryAfterCommitPublisher } from "../../services/push-delivery-after-commit.publisher";

/** 알림과 일반 push outbox를 한 transaction으로 만들고 부수효과는 commit 뒤 시작한다. */
@Injectable()
export class SendNotificationUseCase {
	readonly #logger = new Logger(SendNotificationUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_DISPATCH_STAGING)
		private readonly pushDispatchStaging: PushDispatchStagingRepositoryPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
		@Inject(AFTER_COMMIT_TASK_REGISTRY)
		private readonly afterCommit: AfterCommitTaskRegistryPort,
		private readonly afterCommitPublisher: PushDeliveryAfterCommitPublisher,
	) {}

	async execute(data: CreateNotificationData): Promise<NotificationRecord | null> {
		try {
			return await this.uow.run(async () => {
				const notification = await this.notificationRepository.createNotification(data);
				const staged = await this.pushDispatchStaging.stage({
					notificationId: notification.id,
					userId: data.userId,
					purpose: data.purpose ?? "TRANSACTIONAL",
					campaignKey: data.campaignKey,
					variantId: data.variantId,
					deliveryMode: "SINGLE",
					force: false,
				});
				this.#registerUnreadCountInvalidation(data.userId);
				this.afterCommitPublisher.register([staged.dispatchId]);
				return notification;
			});
		} catch (error) {
			if (error instanceof DuplicateNotificationError) {
				this.#logger.debug(
					`Notification dedup: unique constraint prevented duplicate ${data.type} for userId=${data.userId}`,
				);
				return null;
			}
			throw error;
		}
	}

	#registerUnreadCountInvalidation(userId: string): void {
		this.afterCommit.register(() => {
			this.cache.invalidateUnreadCount(userId).catch((error: unknown) => {
				this.#logger.warn(
					`Failed to invalidate unread notification count: userId=${userId}, ${error}`,
				);
			});
			return Promise.resolve();
		});
	}
}

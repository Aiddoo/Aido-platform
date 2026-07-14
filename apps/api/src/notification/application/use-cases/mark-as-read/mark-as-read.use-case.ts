import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { Notification } from "../../../domain/entities/notification.entity";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

/**
 * 단일 알림 읽음 처리 유스케이스.
 *
 * 대상 부재는 NOTIFICATION_1004, 소유권 위반은 애그리게잇이 NOTIFICATION_1005로
 * 차단한다. 이미 읽은 알림은 무동작(멱등).
 */
@Injectable()
export class MarkAsReadUseCase {
	readonly #logger = new Logger(MarkAsReadUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(userId: string, notificationId: number): Promise<void> {
		const record =
			await this.notificationRepository.findNotificationById(notificationId);

		if (!record) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1004, {
				notificationId,
			});
		}

		const notification = Notification.reconstitute(record);
		if (!notification.planMarkRead(userId)) {
			return;
		}

		const changed = await this.notificationRepository.markAsRead(
			notificationId,
			userId,
		);
		if (changed) {
			await this.cacheService.invalidateUnreadCount(userId);
		}

		this.#logger.debug(`Notification read processed: id=${notificationId}`);
	}
}

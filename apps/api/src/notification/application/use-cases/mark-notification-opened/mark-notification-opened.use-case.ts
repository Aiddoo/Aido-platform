import { Inject, Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

/** 푸시 탭을 멱등 기록하고 알림 센터 상태도 즉시 읽음으로 맞춘다. */
@Injectable()
export class MarkNotificationOpenedUseCase {
	readonly #logger = new Logger(MarkNotificationOpenedUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(userId: string, notificationId: number): Promise<boolean> {
		const opened = await this.notificationRepository.markAsOpened(
			notificationId,
			userId,
		);
		if (opened) {
			await this.cacheService.invalidateUnreadCount(userId);
			this.#logger.log(
				`Push opened: userId=${userId}, notificationId=${notificationId}`,
			);
		}
		return opened;
	}
}

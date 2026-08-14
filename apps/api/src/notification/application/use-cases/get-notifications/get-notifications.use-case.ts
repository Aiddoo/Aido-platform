import { CATEGORY_TYPE_MAP, type NotificationCategory } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";

import type { NotificationRecord } from "../../../domain/records/notification.record";
import type { NotificationType } from "../../../domain/types/notification-type";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

export interface GetNotificationsInput {
	userId: string;
	cursor?: number;
	size?: number;
	unreadOnly?: boolean;
	category?: NotificationCategory;
}

/**
 * 알림 목록 조회 유스케이스 (커서 기반 페이지네이션).
 *
 * 카테고리 필터를 알림 타입 목록으로 변환하고, DTO 매핑은 프레젠테이션에 위임한다.
 */
@Injectable()
export class GetNotificationsUseCase {
	readonly #logger = new Logger(GetNotificationsUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		input: GetNotificationsInput,
	): Promise<CursorPaginatedResponse<NotificationRecord, number>> {
		const { cursor, size } = this.paginationService.normalizeCursorPagination<number>({
			cursor: input.cursor,
			size: input.size,
		});

		const types: NotificationType[] | undefined =
			input.category && input.category !== "ALL"
				? [...CATEGORY_TYPE_MAP[input.category]]
				: undefined;

		const notifications = await this.notificationRepository.findNotificationsByUser({
			userId: input.userId,
			cursor,
			size,
			unreadOnly: input.unreadOnly,
			types,
		});

		this.#logger.debug(
			`Notifications listed: ${notifications.length} items for user: ${input.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<NotificationRecord, number>({
			items: notifications,
			size,
		});
	}
}

import { Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import type { NotificationRecord } from "../../domain/records/notification.record";
import type { RegisterPushTokenData } from "../ports/notification-data";
import {
	type GetNotificationsInput,
	GetNotificationsUseCase,
} from "../use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "../use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "../use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "../use-cases/mark-as-read/mark-as-read.use-case";
import { RegisterPushTokenUseCase } from "../use-cases/register-push-token/register-push-token.use-case";
import { UnregisterPushTokenUseCase } from "../use-cases/unregister-push-token/unregister-push-token.use-case";

/**
 * 알림 프레젠테이션 파사드.
 *
 * 컨트롤러의 유일한 주입 대상. 조회·읽음·토큰 유스케이스를 조합한다.
 * (모듈 간 알림 발송/큐잉은 NotificationService·NotificationQueueService가 담당)
 */
@Injectable()
export class NotificationFacade {
	constructor(
		private readonly getNotificationsUseCase: GetNotificationsUseCase,
		private readonly getUnreadCountUseCase: GetUnreadCountUseCase,
		private readonly markAsReadUseCase: MarkAsReadUseCase,
		private readonly markAllAsReadUseCase: MarkAllAsReadUseCase,
		private readonly registerPushTokenUseCase: RegisterPushTokenUseCase,
		private readonly unregisterPushTokenUseCase: UnregisterPushTokenUseCase,
	) {}

	getNotifications(
		input: GetNotificationsInput,
	): Promise<CursorPaginatedResponse<NotificationRecord, number>> {
		return this.getNotificationsUseCase.execute(input);
	}

	getUnreadCount(userId: string): Promise<number> {
		return this.getUnreadCountUseCase.execute(userId);
	}

	markAsRead(userId: string, notificationId: number): Promise<void> {
		return this.markAsReadUseCase.execute(userId, notificationId);
	}

	markAllAsRead(userId: string): Promise<{ count: number }> {
		return this.markAllAsReadUseCase.execute(userId);
	}

	registerPushToken(data: RegisterPushTokenData): Promise<void> {
		return this.registerPushTokenUseCase.execute(data);
	}

	unregisterPushToken(userId: string, deviceId?: string): Promise<void> {
		return this.unregisterPushTokenUseCase.execute(userId, deviceId);
	}
}

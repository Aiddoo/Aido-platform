import { Inject, Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { NotificationRecord } from "../../domain/records/notification.record";
import type { NotificationType } from "../../domain/types/notification-type";
import type {
	CreateNotificationData,
	RegisterPushTokenData,
} from "../ports/notification-data";
import {
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "../ports/push-dispatcher.port";
import { FindAlreadyNotifiedUsersUseCase } from "../use-cases/find-already-notified-users/find-already-notified-users.use-case";
import {
	type GetNotificationsInput,
	GetNotificationsUseCase,
} from "../use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "../use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "../use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "../use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "../use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "../use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { RegisterPushTokenUseCase } from "../use-cases/register-push-token/register-push-token.use-case";
import { SendBatchNotificationUseCase } from "../use-cases/send-batch-notification/send-batch-notification.use-case";
import { SendNotificationUseCase } from "../use-cases/send-notification/send-notification.use-case";
import { SendNotificationWithDedupUseCase } from "../use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import { UnregisterPushTokenUseCase } from "../use-cases/unregister-push-token/unregister-push-token.use-case";

/**
 * 알림 파사드.
 *
 * 모듈의 유일한 공개 주입 대상. 컨트롤러의 조회·읽음·토큰 유스케이스와
 * 크로스모듈 발송/디스패치 유스케이스(스케줄러·프로세서·어댑터가 소비)를 조합한다.
 */
@Injectable()
export class NotificationFacade {
	constructor(
		private readonly getNotificationsUseCase: GetNotificationsUseCase,
		private readonly getUnreadCountUseCase: GetUnreadCountUseCase,
		private readonly markAsReadUseCase: MarkAsReadUseCase,
		private readonly markNotificationOpenedUseCase: MarkNotificationOpenedUseCase,
		private readonly markAllAsReadUseCase: MarkAllAsReadUseCase,
		private readonly registerPushTokenUseCase: RegisterPushTokenUseCase,
		private readonly unregisterPushTokenUseCase: UnregisterPushTokenUseCase,
		private readonly optOutMarketingPushUseCase: OptOutMarketingPushUseCase,
		private readonly sendNotificationUseCase: SendNotificationUseCase,
		private readonly sendNotificationWithDedupUseCase: SendNotificationWithDedupUseCase,
		private readonly sendBatchNotificationUseCase: SendBatchNotificationUseCase,
		private readonly findAlreadyNotifiedUsersUseCase: FindAlreadyNotifiedUsersUseCase,
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
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

	markOpened(userId: string, notificationId: number): Promise<boolean> {
		return this.markNotificationOpenedUseCase.execute(userId, notificationId);
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

	optOutMarketingPush(token: string): Promise<boolean> {
		return this.optOutMarketingPushUseCase.execute(token);
	}

	/** 알림 생성 + 푸시 발송 */
	createAndSend(
		data: CreateNotificationData,
	): Promise<NotificationRecord | null> {
		return this.sendNotificationUseCase.execute(data);
	}

	/** 중복 방지가 적용된 알림 생성 + 푸시 발송 */
	createAndSendWithDedup(
		data: CreateNotificationData,
	): Promise<NotificationRecord | null> {
		return this.sendNotificationWithDedupUseCase.execute(data);
	}

	/** 다수 사용자 알림 생성 + 배치 푸시 발송 */
	createAndSendBatch(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }> {
		return this.sendBatchNotificationUseCase.execute(dataList);
	}

	/** 이미 알림을 받은 사용자 ID 조회(배치 dedup) */
	findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		return this.findAlreadyNotifiedUsersUseCase.execute(params);
	}

	/** 수신자 푸시 언어 조회 */
	getUserLocale(userId: string): Promise<SupportedLocale> {
		return this.pushDispatcher.getUserLocale(userId);
	}
}

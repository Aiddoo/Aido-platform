import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	type CheerSentEventPayload,
	NotificationEvents,
} from "../events/notification.events";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

/**
 * Cheer 이벤트 리스너
 *
 * CheerModule에서 발행하는 이벤트를 수신하여 알림을 생성합니다.
 * - cheer.sent: 응원 발송 완료
 */
@Injectable()
export class CheerListener {
	private readonly logger = new Logger(CheerListener.name);

	constructor(private readonly notificationService: NotificationService) {}

	/**
	 * Cheer 발송 이벤트 처리
	 *
	 * 응원을 받은 사용자에게 푸시 알림을 발송합니다.
	 */
	@OnEvent(NotificationEvents.CHEER_SENT)
	async handleCheerSent(payload: CheerSentEventPayload): Promise<void> {
		this.logger.debug(
			`Handling cheer.sent event: ${payload.senderId} -> ${payload.receiverId}`,
		);

		try {
			const message = NotificationMessageBuilder.cheerReceived(
				payload.senderName,
				payload.message,
			);

			await this.notificationService.createAndSend({
				userId: payload.receiverId,
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				route: `/friends/${payload.senderId}`,
				cheerId: payload.cheerId,
				friendId: payload.senderId,
				metadata: payload.message ? { message: payload.message } : undefined,
			});

			this.logger.log(
				`Cheer notification sent: from=${payload.senderId}, to=${payload.receiverId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send cheer notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

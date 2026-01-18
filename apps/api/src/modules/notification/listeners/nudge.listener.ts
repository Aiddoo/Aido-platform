import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	NotificationEvents,
	type NudgeSentEventPayload,
} from "../events/notification.events";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

/**
 * Nudge 이벤트 리스너
 *
 * NudgeModule에서 발행하는 이벤트를 수신하여 알림을 생성합니다.
 * - nudge.sent: 독촉 발송 완료
 */
@Injectable()
export class NudgeListener {
	private readonly logger = new Logger(NudgeListener.name);

	constructor(private readonly notificationService: NotificationService) {}

	/**
	 * Nudge 발송 이벤트 처리
	 *
	 * 독촉을 받은 사용자에게 푸시 알림을 발송합니다.
	 */
	@OnEvent(NotificationEvents.NUDGE_SENT)
	async handleNudgeSent(payload: NudgeSentEventPayload): Promise<void> {
		this.logger.debug(
			`Handling nudge.sent event: ${payload.senderId} -> ${payload.receiverId}`,
		);

		try {
			const message = NotificationMessageBuilder.nudgeReceived(
				payload.senderName,
			);

			// route 결정: todoId가 있으면 해당 할일로, 없으면 친구 프로필로
			const route = payload.todoId
				? `/todos/${payload.todoId}`
				: `/friends/${payload.senderId}`;

			await this.notificationService.createAndSend({
				userId: payload.receiverId,
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				route,
				nudgeId: payload.nudgeId,
				friendId: payload.senderId,
				todoId: payload.todoId,
			});

			this.logger.log(
				`Nudge notification sent: from=${payload.senderId}, to=${payload.receiverId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send nudge notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { buildUserRegisteredMessage } from "../../../domain/services/admin-message.factory";
import type { UserRegisteredEventPayload } from "../../../domain/types/user-registered.payload";
import {
	ADMIN_NOTIFICATION_QUEUE_PORT,
	type AdminNotificationQueuePort,
} from "../../ports/admin-notification-queue.port";

/**
 * 회원가입 관리자 알림 등록 유스케이스.
 *
 * 회원가입 이벤트를 관리자 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 */
@Injectable()
export class EnqueueUserRegisteredUseCase {
	constructor(
		@Inject(ADMIN_NOTIFICATION_QUEUE_PORT)
		private readonly queue: AdminNotificationQueuePort,
	) {}

	async execute(payload: UserRegisteredEventPayload): Promise<void> {
		const message = buildUserRegisteredMessage(payload);
		await this.queue.enqueueSend("admin", message.toPayload());
	}
}

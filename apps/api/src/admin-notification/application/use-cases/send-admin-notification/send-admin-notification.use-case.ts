import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AdminNotification } from "../../../domain/value-objects/admin-notification-message.vo";
import type { NotificationChannel } from "../../ports/admin-notification-queue.port";
import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "../../ports/admin-notifier.port";

/**
 * 관리자 알림 발송 유스케이스.
 *
 * 채널에 따라 관리자/결제 Discord 프로바이더를 선택해 발송한다.
 * 발송 실패 시 예외를 던져 BullMQ 재시도를 트리거한다.
 */
@Injectable()
export class SendAdminNotificationUseCase {
	readonly #logger = new Logger(SendAdminNotificationUseCase.name);

	constructor(
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
		@Inject(PAYMENT_NOTIFIER)
		private readonly paymentNotifier: AdminNotifier,
	) {}

	async execute(
		channel: NotificationChannel,
		notification: AdminNotification,
	): Promise<void> {
		const notifier =
			channel === "payment" ? this.paymentNotifier : this.adminNotifier;

		this.#logger.debug(
			`Processing admin notification: channel=${channel}, title=${notification.title}`,
		);

		const result = await notifier.send(notification);

		if (!result.success) {
			throw new Error(`Discord webhook failed: ${result.error}`);
		}

		this.#logger.log(
			`Admin notification sent: channel=${channel}, title=${notification.title}`,
		);
	}
}

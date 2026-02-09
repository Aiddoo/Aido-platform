import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	AdminNotificationEvents,
	type UserRegisteredEventPayload,
} from "../events/admin-notification.events";
import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
} from "../providers/admin-notifier.interface";

const PROVIDER_LABELS: Record<string, string> = {
	credential: "이메일",
	apple: "Apple",
	google: "Google",
	kakao: "Kakao",
	naver: "Naver",
};

/**
 * 회원가입 이벤트 리스너
 *
 * AuthService/OAuthService에서 발행하는 user.registered 이벤트를 수신하여
 * 관리자 알림 채널(Discord 등)에 알림을 발송합니다.
 */
@Injectable()
export class UserRegistrationListener {
	private readonly logger = new Logger(UserRegistrationListener.name);

	constructor(
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
	) {}

	@OnEvent(AdminNotificationEvents.USER_REGISTERED)
	async handleUserRegistered(
		payload: UserRegisteredEventPayload,
	): Promise<void> {
		this.logger.debug(
			`Handling user.registered event: ${payload.userId} (${payload.email})`,
		);

		try {
			const providerLabel =
				PROVIDER_LABELS[payload.provider] ?? payload.provider;

			const result = await this.adminNotifier.send({
				title: "새로운 회원가입",
				body: "새로운 사용자가 가입했습니다.",
				color: 0x57f287,
				fields: [
					{ name: "이메일", value: payload.email, inline: true },
					{ name: "가입 방식", value: providerLabel, inline: true },
					{ name: "사용자 ID", value: payload.userId, inline: false },
					{
						name: "가입 시각",
						value: payload.registeredAt,
						inline: false,
					},
				],
			});

			if (result.success) {
				this.logger.log(
					`Admin notification sent for new registration: ${payload.userId}`,
				);
			} else {
				this.logger.warn(`Admin notification failed: ${result.error}`);
			}
		} catch (error) {
			this.logger.error(
				`Failed to send admin notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

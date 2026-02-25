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

/**
 * ISO 날짜 문자열을 Discord 타임스탬프 포맷으로 변환
 */
function formatDate(isoString: string): string {
	try {
		const unixSeconds = Math.floor(new Date(isoString).getTime() / 1000);
		return `<t:${unixSeconds}:f>`;
	} catch {
		return isoString;
	}
}

const PROVIDER_LABELS: Record<string, string> = {
	credential: "이메일",
	apple: "Apple",
	google: "Google",
	kakao: "Kakao",
	naver: "Naver",
};

/**
 * 가입 방식 → 기기 추정 라벨 (Apple/Google만 추정 가능)
 */
const PROVIDER_DEVICE_LABELS: Record<string, string> = {
	apple: "🍎 iOS (추정)",
	google: "🤖 Android (추정)",
};

/**
 * 회원가입 이벤트 리스너
 *
 * AuthService/OAuthService에서 발행하는 user.registered 이벤트를 수신하여
 * 관리자 알림 채널(Discord 등)에 알림을 발송합니다.
 */
@Injectable()
export class UserRegistrationListener {
	readonly #logger = new Logger(UserRegistrationListener.name);

	constructor(
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
	) {}

	@OnEvent(AdminNotificationEvents.USER_REGISTERED)
	async handleUserRegistered(
		payload: UserRegisteredEventPayload,
	): Promise<void> {
		this.#logger.debug(
			`Handling user.registered event: ${payload.userId} (${payload.email})`,
		);

		try {
			const providerLabel =
				PROVIDER_LABELS[payload.provider] ?? payload.provider;
			const deviceLabel = PROVIDER_DEVICE_LABELS[payload.provider];

			const fields: Array<{ name: string; value: string; inline?: boolean }> = [
				{ name: "이메일", value: payload.email, inline: true },
				{ name: "가입 방식", value: providerLabel, inline: true },
			];

			if (deviceLabel) {
				fields.push({ name: "기기 (추정)", value: deviceLabel, inline: true });
			}

			fields.push(
				{ name: "사용자 ID", value: payload.userId, inline: false },
				{
					name: "가입 시각",
					value: formatDate(payload.registeredAt),
					inline: false,
				},
			);

			const result = await this.adminNotifier.send({
				title: "새로운 회원가입",
				body: `**${payload.email}** 님이 가입했습니다.`,
				color: 0x57f287,
				fields,
			});

			if (result.success) {
				this.#logger.log(
					`Admin notification sent for new registration: ${payload.userId}`,
				);
			} else {
				this.#logger.warn(`Admin notification failed: ${result.error}`);
			}
		} catch (error) {
			this.#logger.error(
				`Failed to send admin notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

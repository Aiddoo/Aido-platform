import { Injectable, Logger } from "@nestjs/common";

import { now } from "@/shared/domain/date/utils/core";
import { toISOString } from "@/shared/domain/date/utils/format";

import type {
	AdminNotification,
	AdminNotifier,
	AdminNotifyResult,
} from "../../application/ports/admin-notifier.port";

/**
 * Discord Webhook Provider
 *
 * Discord Webhook을 통한 관리자 알림 발송
 * 모듈에서 factory provider로 채널별 인스턴스를 생성합니다.
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
@Injectable()
export class DiscordWebhookProvider implements AdminNotifier {
	readonly name = "discord";
	readonly #logger = new Logger(DiscordWebhookProvider.name);
	readonly #webhookUrl: string | undefined;

	constructor(webhookUrl: string | undefined) {
		this.#webhookUrl = webhookUrl;
	}

	isConfigured(): boolean {
		return !!this.#webhookUrl;
	}

	async send(notification: AdminNotification): Promise<AdminNotifyResult> {
		const webhookUrl = this.#webhookUrl;
		if (!webhookUrl) {
			this.#logger.debug("Discord webhook not configured, skipping notification");
			return { success: false, error: "Webhook URL not configured" };
		}

		try {
			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					embeds: [
						{
							title: notification.title,
							description: notification.body,
							color: notification.color ?? 0x5865f2,
							fields: notification.fields ?? [],
							timestamp: toISOString(now()),
						},
					],
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.#logger.error(`Discord webhook failed: ${response.status} ${errorText}`);
				return {
					success: false,
					error: `HTTP ${response.status}: ${errorText}`,
				};
			}

			return { success: true };
		} catch (error) {
			this.#logger.error(`Discord webhook error: ${error}`);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}

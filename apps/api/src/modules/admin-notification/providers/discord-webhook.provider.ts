import { Injectable, Logger } from "@nestjs/common";
import { TypedConfigService } from "@/common/config/services/config.service";
import type {
	AdminNotification,
	AdminNotifier,
	AdminNotifyResult,
} from "./admin-notifier.interface";

/**
 * Discord Webhook Provider
 *
 * Discord Webhook을 통한 관리자 알림 발송
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
@Injectable()
export class DiscordWebhookProvider implements AdminNotifier {
	readonly name = "discord";
	private readonly logger = new Logger(DiscordWebhookProvider.name);
	private readonly webhookUrl: string | undefined;

	constructor(config: TypedConfigService) {
		const isTestRuntime =
			config.isTest || typeof process.env.JEST_WORKER_ID !== "undefined";

		if (isTestRuntime) {
			this.webhookUrl = undefined;
			this.logger.debug(
				"Test runtime detected, Discord webhook notifications are disabled",
			);
			return;
		}

		this.webhookUrl = config.discordSignupWebhookUrl;
	}

	isConfigured(): boolean {
		return !!this.webhookUrl;
	}

	async send(notification: AdminNotification): Promise<AdminNotifyResult> {
		const { webhookUrl } = this;
		if (!webhookUrl) {
			this.logger.debug(
				"Discord webhook not configured, skipping notification",
			);
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
							timestamp: new Date().toISOString(),
						},
					],
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					`Discord webhook failed: ${response.status} ${errorText}`,
				);
				return {
					success: false,
					error: `HTTP ${response.status}: ${errorText}`,
				};
			}

			return { success: true };
		} catch (error) {
			this.logger.error(`Discord webhook error: ${error}`);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}

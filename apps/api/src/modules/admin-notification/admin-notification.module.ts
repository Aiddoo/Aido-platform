import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { TypedConfigService } from "@/common/config/services/config.service";
import { DatabaseModule } from "@/database";

import { DailySignupSummaryJob } from "./jobs/daily-signup-summary.job";
import { UserRegistrationListener } from "./listeners/user-registration.listener";
import {
	ADMIN_NOTIFICATION_QUEUE,
	AdminNotificationProcessor,
} from "./processors/admin-notification.processor";
import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "./providers/admin-notifier.interface";
import { DiscordWebhookProvider } from "./providers/discord-webhook.provider";

function isTestRuntime(config: TypedConfigService): boolean {
	return config.isTest || typeof process.env.JEST_WORKER_ID !== "undefined";
}

@Module({
	imports: [
		DatabaseModule,
		BullModule.registerQueue({ name: ADMIN_NOTIFICATION_QUEUE }),
	],
	providers: [
		{
			provide: ADMIN_NOTIFIER,
			useFactory: (config: TypedConfigService) =>
				new DiscordWebhookProvider(
					isTestRuntime(config) ? undefined : config.discordSignupWebhookUrl,
				),
			inject: [TypedConfigService],
		},
		{
			provide: PAYMENT_NOTIFIER,
			useFactory: (config: TypedConfigService) =>
				new DiscordWebhookProvider(
					isTestRuntime(config) ? undefined : config.discordPaymentWebhookUrl,
				),
			inject: [TypedConfigService],
		},
		AdminNotificationProcessor,
		UserRegistrationListener,
		DailySignupSummaryJob,
	],
	exports: [ADMIN_NOTIFIER, PAYMENT_NOTIFIER, BullModule],
})
export class AdminNotificationModule {}

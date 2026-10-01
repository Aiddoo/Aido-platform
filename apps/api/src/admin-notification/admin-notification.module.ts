import { Module } from "@nestjs/common";

import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { DatabaseModule } from "#api/shared/infrastructure/database/index";

import { AdminEventNotifier } from "./application/notifiers/admin-event.notifier.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/admin-notification-queue.port.js";
import { ADMIN_NOTIFIER, PAYMENT_NOTIFIER } from "./application/ports/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/signup-stats.reader.port.js";
import { DispatchDailySignupSummaryUseCase } from "./application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case.js";
import { EnqueueSubscriptionEventUseCase } from "./application/use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case.js";
import { EnqueueUserRegisteredUseCase } from "./application/use-cases/enqueue-user-registered/enqueue-user-registered.use-case.js";
import { SendAdminNotificationUseCase } from "./application/use-cases/send-admin-notification/send-admin-notification.use-case.js";
import { BullmqAdminNotificationQueueAdapter } from "./infrastructure/adapters/bullmq-admin-notification-queue.adapter.js";
import { DiscordWebhookProvider } from "./infrastructure/adapters/discord-webhook.provider.js";
import { PrismaSignupStatsReader } from "./infrastructure/adapters/prisma-signup-stats.reader.js";
import { AdminNotificationProcessor } from "./infrastructure/queue/admin-notification-queue.processor.js";
import { DailySignupSummaryScheduler } from "./infrastructure/scheduler/daily-signup-summary.scheduler.js";

function isTestRuntime(config: TypedConfigService): boolean {
	return config.isTest || typeof process.env.JEST_WORKER_ID !== "undefined";
}

@Module({
	imports: [DatabaseModule],
	providers: [
		AdminEventNotifier,
		EnqueueUserRegisteredUseCase,
		EnqueueSubscriptionEventUseCase,
		SendAdminNotificationUseCase,
		DispatchDailySignupSummaryUseCase,
		AdminNotificationProcessor,
		DailySignupSummaryScheduler,
		{
			provide: ADMIN_NOTIFICATION_QUEUE_PORT,
			useClass: BullmqAdminNotificationQueueAdapter,
		},
		{
			provide: SIGNUP_STATS_READER,
			useClass: PrismaSignupStatsReader,
		},
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
	],
	exports: [AdminEventNotifier, ADMIN_NOTIFIER, PAYMENT_NOTIFIER],
})
export class AdminNotificationModule {}

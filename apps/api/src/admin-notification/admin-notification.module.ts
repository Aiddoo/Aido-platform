import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseModule } from "@/shared/infrastructure/database";

import { AdminNotificationFacade } from "./application/facades/admin-notification.facade";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/admin-notification-queue.port";
import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "./application/ports/admin-notifier.port";
import { SIGNUP_STATS_READER } from "./application/ports/signup-stats.reader.port";
import { DispatchDailySignupSummaryUseCase } from "./application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case";
import { EnqueueSubscriptionEventUseCase } from "./application/use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case";
import { EnqueueUserRegisteredUseCase } from "./application/use-cases/enqueue-user-registered/enqueue-user-registered.use-case";
import { SendAdminNotificationUseCase } from "./application/use-cases/send-admin-notification/send-admin-notification.use-case";
import { BullmqAdminNotificationQueueAdapter } from "./infrastructure/adapters/bullmq-admin-notification-queue.adapter";
import { DiscordWebhookProvider } from "./infrastructure/adapters/discord-webhook.provider";
import { PrismaSignupStatsReader } from "./infrastructure/adapters/prisma-signup-stats.reader";
import { ADMIN_NOTIFICATION_QUEUE } from "./infrastructure/queue/admin-notification-queue.constants";
import { AdminNotificationProcessor } from "./infrastructure/queue/admin-notification-queue.processor";
import { DailySignupSummaryScheduler } from "./infrastructure/scheduler/daily-signup-summary.scheduler";

function isTestRuntime(config: TypedConfigService): boolean {
	return config.isTest || typeof process.env.JEST_WORKER_ID !== "undefined";
}

@Module({
	imports: [
		DatabaseModule,
		BullModule.registerQueue({ name: ADMIN_NOTIFICATION_QUEUE }),
	],
	providers: [
		AdminNotificationFacade,
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
	exports: [
		AdminNotificationFacade,
		ADMIN_NOTIFIER,
		PAYMENT_NOTIFIER,
		BullModule,
	],
})
export class AdminNotificationModule {}

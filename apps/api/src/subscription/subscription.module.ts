import { Module } from "@nestjs/common";

import { AdminNotificationModule } from "@/admin-notification/admin-notification.module";
import { NotificationModule } from "@/notification/notification.module";

import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscription.repository.port";
import { SUBSCRIPTION_CACHE } from "./application/ports/subscription-cache.port";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscription-event-notifier.port";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscription-webhook-lock.port";
import { HandleWebhookEventUseCase } from "./application/use-cases/handle-webhook-event/handle-webhook-event.use-case";
import { SubscriptionCacheAdapter } from "./infrastructure/adapters/subscription-cache.adapter";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscription-event-notifier.adapter";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscription-webhook-lock.adapter";
import { WebhookSignatureGuard } from "./infrastructure/guards/webhook-signature.guard";
import { PrismaSubscriptionRepository } from "./infrastructure/persistence/prisma-subscription.repository";
import { SubscriptionController } from "./presentation/subscription.controller";

@Module({
	imports: [AdminNotificationModule, NotificationModule],
	controllers: [SubscriptionController],
	providers: [
		HandleWebhookEventUseCase,
		WebhookSignatureGuard,
		{
			provide: SUBSCRIPTION_REPOSITORY,
			useClass: PrismaSubscriptionRepository,
		},
		{ provide: SUBSCRIPTION_CACHE, useClass: SubscriptionCacheAdapter },
		{
			provide: SUBSCRIPTION_EVENT_NOTIFIER,
			useClass: SubscriptionEventNotifierAdapter,
		},
		{
			provide: SUBSCRIPTION_WEBHOOK_LOCK,
			useClass: SubscriptionWebhookLockAdapter,
		},
	],
})
export class SubscriptionModule {}

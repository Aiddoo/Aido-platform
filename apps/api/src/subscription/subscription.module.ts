import { Module } from "@nestjs/common";

import { AdminNotificationModule } from "#api/admin-notification/admin-notification.module";
import { NotificationModule } from "#api/notification/index";

import { SUBSCRIPTION_CACHE } from "./application/ports/subscription-cache.port.js";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscription-event-notifier.port.js";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscription-webhook-lock.port.js";
import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscription.repository.port.js";
import { HandleWebhookEventUseCase } from "./application/use-cases/handle-webhook-event/handle-webhook-event.use-case.js";
import { SubscriptionCacheAdapter } from "./infrastructure/adapters/subscription-cache.adapter.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscription-event-notifier.adapter.js";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscription-webhook-lock.adapter.js";
import { WebhookSignatureGuard } from "./infrastructure/guards/webhook-signature.guard.js";
import { PrismaSubscriptionRepository } from "./infrastructure/persistence/prisma-subscription.repository.js";
import { SubscriptionController } from "./presentation/subscription.controller.js";

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

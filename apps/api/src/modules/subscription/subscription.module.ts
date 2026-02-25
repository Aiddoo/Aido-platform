import { Module } from "@nestjs/common";

import { AdminNotificationModule } from "@/modules/admin-notification/admin-notification.module";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { SubscriptionNotificationListener } from "./listeners/subscription-notification.listener";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionRepository } from "./subscription.repository";
import { SubscriptionService } from "./subscription.service";

@Module({
	imports: [AdminNotificationModule],
	controllers: [SubscriptionController],
	providers: [
		SubscriptionService,
		SubscriptionRepository,
		WebhookSignatureGuard,
		SubscriptionNotificationListener,
	],
	exports: [SubscriptionService],
})
export class SubscriptionModule {}

import { Module } from "@nestjs/common";

import { AdminNotificationModule } from "@/modules/admin-notification/admin-notification.module";
import { NotificationModule } from "@/modules/notification/notification.module";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionRepository } from "./subscription.repository";
import { SubscriptionService } from "./subscription.service";

@Module({
	imports: [AdminNotificationModule, NotificationModule],
	controllers: [SubscriptionController],
	providers: [
		SubscriptionService,
		SubscriptionRepository,
		WebhookSignatureGuard,
	],
	exports: [SubscriptionService],
})
export class SubscriptionModule {}

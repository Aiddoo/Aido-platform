import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AdminNotificationModule } from "@/modules/admin-notification/admin-notification.module";
import { ADMIN_NOTIFICATION_QUEUE } from "@/modules/admin-notification/processors/admin-notification.processor";
import { NotificationModule } from "@/modules/notification/notification.module";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { SubscriptionBillingIssueListener } from "./listeners/subscription-billing-issue.listener";
import { SubscriptionNotificationListener } from "./listeners/subscription-notification.listener";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionRepository } from "./subscription.repository";
import { SubscriptionService } from "./subscription.service";

@Module({
	imports: [
		AdminNotificationModule,
		NotificationModule,
		BullModule.registerQueue({ name: ADMIN_NOTIFICATION_QUEUE }),
	],
	controllers: [SubscriptionController],
	providers: [
		SubscriptionService,
		SubscriptionRepository,
		WebhookSignatureGuard,
		SubscriptionNotificationListener,
		SubscriptionBillingIssueListener,
	],
	exports: [SubscriptionService],
})
export class SubscriptionModule {}

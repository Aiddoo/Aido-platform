import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";

import { OPERATIONS_BROADCASTS_PROVIDERS } from "./operations-broadcasts.providers.js";
import { AdminNotificationController } from "./presentation/http/v1/admin-notification.controller.js";
import { BroadcastCampaignController } from "./presentation/http/v2/broadcast-campaign.controller.js";

@Module({
  imports: [NotificationPushModule],
  controllers: [AdminNotificationController, BroadcastCampaignController],
  providers: [...OPERATIONS_BROADCASTS_PROVIDERS],
})
export class OperationsBroadcastsModule {}

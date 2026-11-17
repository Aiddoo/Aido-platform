import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";

import { OPERATIONS_BROADCAST_CAMPAIGNS_PROVIDERS } from "./operations-broadcast-campaigns.providers.js";
import { AdminNotificationController } from "./presentation/http/v1/admin-notification.controller.js";
import { BroadcastCampaignController } from "./presentation/http/v2/broadcast-campaign.controller.js";

@Module({
  imports: [NotificationPushModule],
  controllers: [AdminNotificationController, BroadcastCampaignController],
  providers: [...OPERATIONS_BROADCAST_CAMPAIGNS_PROVIDERS],
})
export class OperationsBroadcastCampaignsModule {}

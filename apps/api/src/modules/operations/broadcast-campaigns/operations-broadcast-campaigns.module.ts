import { Module } from "@nestjs/common";

import { NotificationNotificationsModule } from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationPushDispatchesModule } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";

import { OPERATIONS_BROADCAST_CAMPAIGNS_PROVIDERS } from "./operations-broadcast-campaigns.providers.js";
import { AdminNotificationController } from "./presentation/http/v1/admin-notification.controller.js";
import { BroadcastCampaignController } from "./presentation/http/v2/broadcast-campaign.controller.js";

@Module({
  imports: [NotificationNotificationsModule, NotificationPushDispatchesModule],
  controllers: [AdminNotificationController, BroadcastCampaignController],
  providers: [...OPERATIONS_BROADCAST_CAMPAIGNS_PROVIDERS],
})
export class OperationsBroadcastCampaignsModule {}

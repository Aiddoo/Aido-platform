import { Module } from "@nestjs/common";

import {
  NotificationDeliveryModule,
  PUSH_CAMPAIGN_OUTCOME_READER,
  type PushCampaignOutcomeReaderPort,
} from "#api/modules/notification/notification-delivery.public";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin-broadcast-notifier.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin-user-directory.reader.port.js";
import { BROADCAST_CAMPAIGN_REPOSITORY } from "./application/ports/broadcast-campaign.repository.port.js";
import {
  BROADCAST_DELIVERY_OUTCOME_READER,
  type BroadcastDeliveryOutcomeReaderPort,
} from "./application/ports/broadcast-delivery-outcome.reader.port.js";
import { BROADCAST_FAN_OUT_ENQUEUER } from "./application/ports/broadcast-fan-out-enqueuer.port.js";
import { BroadcastFanOutEnqueuerAdapter } from "./infrastructure/adapters/broadcast-fan-out-enqueuer.adapter.js";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/notification-admin-broadcast-notifier.adapter.js";
import { BroadcastFanOutProcessor } from "./infrastructure/jobs/broadcast-fan-out.processor.js";
import { DrizzleAdminUserDirectoryAdapter } from "./infrastructure/persistence/drizzle-admin-user-directory.reader.js";
import { DrizzleBroadcastCampaignRepository } from "./infrastructure/persistence/drizzle-broadcast-campaign.repository.js";
import {
  broadcastNotificationProvider,
  createBroadcastCampaignProvider,
  failBroadcastCampaignProvider,
  fanOutBroadcastCampaignProvider,
  getBroadcastCampaignProvider,
  sendTargetedNotificationProvider,
} from "./operations-broadcasts.providers.js";
import { AdminController } from "./presentation/http/v1/admin-notification.controller.js";
import { AdminBroadcastCampaignController } from "./presentation/http/v2/broadcast-campaign.controller.js";

@Module({
  imports: [NotificationDeliveryModule],
  controllers: [AdminController, AdminBroadcastCampaignController],
  providers: [
    {
      provide: ADMIN_USER_DIRECTORY,
      useClass: DrizzleAdminUserDirectoryAdapter,
    },
    {
      provide: ADMIN_BROADCAST_NOTIFIER,
      useClass: NotificationAdminBroadcastNotifierAdapter,
    },
    { provide: BROADCAST_CAMPAIGN_REPOSITORY, useClass: DrizzleBroadcastCampaignRepository },
    { provide: BROADCAST_FAN_OUT_ENQUEUER, useClass: BroadcastFanOutEnqueuerAdapter },
    {
      provide: BROADCAST_DELIVERY_OUTCOME_READER,
      inject: [PUSH_CAMPAIGN_OUTCOME_READER],
      useFactory: (reader: PushCampaignOutcomeReaderPort): BroadcastDeliveryOutcomeReaderPort =>
        reader,
    },
    createBroadcastCampaignProvider,
    broadcastNotificationProvider,
    fanOutBroadcastCampaignProvider,
    failBroadcastCampaignProvider,
    getBroadcastCampaignProvider,
    sendTargetedNotificationProvider,
    BroadcastFanOutProcessor,
  ],
})
export class OperationsBroadcastsModule {}

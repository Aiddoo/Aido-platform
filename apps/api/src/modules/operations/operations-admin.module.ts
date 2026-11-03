import { Module } from "@nestjs/common";

import {
  NotificationDeliveryModule,
  PUSH_CAMPAIGN_OUTCOME_READER,
  type PushCampaignOutcomeReaderPort,
} from "#api/modules/notification/notification-delivery.public";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin/admin-broadcast-notifier.port.js";
import { ADMIN_GROWTH_METRICS } from "./application/ports/admin/admin-growth-metrics.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin/admin-user-directory.port.js";
import { BROADCAST_CAMPAIGN_REPOSITORY } from "./application/ports/admin/broadcast-campaign.repository.port.js";
import {
  BROADCAST_DELIVERY_OUTCOME_READER,
  type BroadcastDeliveryOutcomeReaderPort,
} from "./application/ports/admin/broadcast-delivery-outcome.reader.port.js";
import { BROADCAST_FAN_OUT_ENQUEUER } from "./application/ports/admin/broadcast-fan-out.enqueuer.port.js";
import { DrizzleAdminGrowthMetricsAdapter } from "./infrastructure/adapters/admin/drizzle-admin-growth-metrics.adapter.js";
import { DrizzleAdminUserDirectoryAdapter } from "./infrastructure/adapters/admin/drizzle-admin-user-directory.adapter.js";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/admin/notification-admin-broadcast-notifier.adapter.js";
import { BroadcastFanOutQueueProcessor } from "./infrastructure/jobs/admin/broadcast-fan-out-queue.processor.js";
import { BroadcastFanOutQueueService } from "./infrastructure/jobs/admin/broadcast-fan-out-queue.service.js";
import { DrizzleBroadcastCampaignRepository } from "./infrastructure/persistence/admin/drizzle-broadcast-campaign.repository.js";
import {
  broadcastNotificationProvider,
  createBroadcastCampaignProvider,
  failBroadcastCampaignProvider,
  fanOutBroadcastCampaignProvider,
  getBroadcastCampaignProvider,
  getGrowthSummaryProvider,
  sendTargetedNotificationProvider,
} from "./operations-admin-application.providers.js";
import { AdminGrowthController } from "./presentation/controllers/admin/v1/admin-growth.controller.js";
import { AdminController } from "./presentation/controllers/admin/v1/admin.controller.js";
import { AdminBroadcastCampaignController } from "./presentation/controllers/admin/v2/admin-broadcast-campaign.controller.js";

@Module({
  imports: [NotificationDeliveryModule],
  controllers: [AdminController, AdminBroadcastCampaignController, AdminGrowthController],
  providers: [
    {
      provide: ADMIN_USER_DIRECTORY,
      useClass: DrizzleAdminUserDirectoryAdapter,
    },
    {
      provide: ADMIN_BROADCAST_NOTIFIER,
      useClass: NotificationAdminBroadcastNotifierAdapter,
    },
    {
      provide: ADMIN_GROWTH_METRICS,
      useClass: DrizzleAdminGrowthMetricsAdapter,
    },
    { provide: BROADCAST_CAMPAIGN_REPOSITORY, useClass: DrizzleBroadcastCampaignRepository },
    { provide: BROADCAST_FAN_OUT_ENQUEUER, useClass: BroadcastFanOutQueueService },
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
    getGrowthSummaryProvider,
    sendTargetedNotificationProvider,
    BroadcastFanOutQueueProcessor,
  ],
})
export class OperationsAdminModule {}

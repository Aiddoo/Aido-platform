import { Module } from "@nestjs/common";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin/admin-broadcast-notifier.port.js";
import { ADMIN_GROWTH_METRICS } from "./application/ports/admin/admin-growth-metrics.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin/admin-user-directory.port.js";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/admin/notification-admin-broadcast-notifier.adapter.js";
import { PrismaAdminGrowthMetricsAdapter } from "./infrastructure/adapters/admin/prisma-admin-growth-metrics.adapter.js";
import { PrismaAdminUserDirectoryAdapter } from "./infrastructure/adapters/admin/prisma-admin-user-directory.adapter.js";
import {
  broadcastNotificationProvider,
  getGrowthSummaryProvider,
  sendTargetedNotificationProvider,
} from "./operations-admin-application.providers.js";
import { AdminGrowthController } from "./presentation/controllers/admin/admin-growth.controller.js";
import { AdminController } from "./presentation/controllers/admin/admin.controller.js";

@Module({
  imports: [NotificationDeliveryModule],
  controllers: [AdminController, AdminGrowthController],
  providers: [
    {
      provide: ADMIN_USER_DIRECTORY,
      useClass: PrismaAdminUserDirectoryAdapter,
    },
    {
      provide: ADMIN_BROADCAST_NOTIFIER,
      useClass: NotificationAdminBroadcastNotifierAdapter,
    },
    {
      provide: ADMIN_GROWTH_METRICS,
      useClass: PrismaAdminGrowthMetricsAdapter,
    },
    broadcastNotificationProvider,
    getGrowthSummaryProvider,
    sendTargetedNotificationProvider,
  ],
})
export class OperationsAdminModule {}

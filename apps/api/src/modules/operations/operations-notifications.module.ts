import { Module } from "@nestjs/common";
import { HttpClientModule, getHttpClientToken } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DatabaseModule } from "#api/platform/database/index";

import { AdminEventNotifier } from "./application/notifiers/notifications/admin-event.notifier.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/notifications/admin-notification-queue.port.js";
import { ADMIN_NOTIFIER } from "./application/ports/notifications/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/notifications/signup-stats.reader.port.js";
import { AdminNotificationQueueAdapter } from "./infrastructure/adapters/notifications/admin-notification-queue.adapter.js";
import { createAdminNotifier } from "./infrastructure/adapters/notifications/admin-notifier.factory.js";
import { DrizzleSignupStatsReader } from "./infrastructure/adapters/notifications/drizzle-signup-stats.reader.js";
import { AdminNotificationProcessor } from "./infrastructure/jobs/notifications/admin-notification-queue.processor.js";
import { DailySignupSummaryScheduler } from "./infrastructure/jobs/notifications/daily-signup-summary.scheduler.js";
import {
  adminEventNotifierProvider,
  dispatchDailySignupSummaryProvider,
  enqueueSubscriptionEventProvider,
  enqueueUserRegisteredProvider,
  sendAdminNotificationProvider,
} from "./operations-notifications-application.providers.js";

@Module({
  imports: [
    DatabaseModule,
    HttpClientModule.register({ name: "discord", retry: false, throwOnHttpError: false }),
  ],
  providers: [
    adminEventNotifierProvider,
    enqueueUserRegisteredProvider,
    enqueueSubscriptionEventProvider,
    sendAdminNotificationProvider,
    dispatchDailySignupSummaryProvider,
    AdminNotificationProcessor,
    DailySignupSummaryScheduler,
    {
      provide: ADMIN_NOTIFICATION_QUEUE_PORT,
      useClass: AdminNotificationQueueAdapter,
    },
    {
      provide: SIGNUP_STATS_READER,
      useClass: DrizzleSignupStatsReader,
    },
    {
      provide: ADMIN_NOTIFIER,
      useFactory: createAdminNotifier,
      inject: [TypedConfigService, getHttpClientToken("discord")],
    },
  ],
  exports: [AdminEventNotifier],
})
export class OperationsNotificationsModule {}

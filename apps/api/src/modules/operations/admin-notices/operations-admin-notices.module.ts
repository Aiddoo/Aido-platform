import { Module } from "@nestjs/common";
import { HttpClientModule, getHttpClientToken } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DatabaseModule } from "#api/platform/database/index";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { ADMIN_NOTICE_USER_READER } from "./application/ports/admin-notice-user.reader.port.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/admin-notification-queue.port.js";
import { ADMIN_NOTIFIER } from "./application/ports/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/signup-stats.reader.port.js";
import { AdminEventNotifier } from "./infrastructure/adapters/admin-event-notifier.adapter.js";
import { AdminNotificationQueueAdapter } from "./infrastructure/adapters/admin-notification-queue.adapter.js";
import { createAdminNotifier } from "./infrastructure/adapters/admin-notifier-selection.adapter.js";
import { AdminNotificationProcessor } from "./infrastructure/jobs/admin-notification.processor.js";
import { DailySignupSummaryScheduler } from "./infrastructure/jobs/daily-signup-summary.scheduler.js";
import { DrizzleAdminNoticeUserReader } from "./infrastructure/persistence/drizzle-admin-notice-user.reader.js";
import { DrizzleSignupStatsReader } from "./infrastructure/persistence/drizzle-signup-stats.reader.js";
import {
  adminEventNotifierProvider,
  adminNoticeUserResolverProvider,
  dispatchDailySignupSummaryProvider,
  enqueueSubscriptionEventProvider,
  enqueueUserRegisteredProvider,
  sendAdminNotificationProvider,
} from "./operations-admin-notices-application.providers.js";

@Module({
  imports: [
    DatabaseModule,
    HttpClientModule.register({ name: "discord", retry: false, throwOnHttpError: false }),
  ],
  providers: [
    adminEventNotifierProvider,
    adminNoticeUserResolverProvider,
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
      provide: ADMIN_NOTICE_USER_READER,
      useClass: DrizzleAdminNoticeUserReader,
    },
    {
      provide: ADMIN_NOTIFIER,
      useFactory: createAdminNotifier,
      inject: [TypedConfigService, getHttpClientToken("discord"), OutboundPolicyRegistry],
    },
  ],
  exports: [AdminEventNotifier],
})
export class OperationsAdminNoticesModule {}

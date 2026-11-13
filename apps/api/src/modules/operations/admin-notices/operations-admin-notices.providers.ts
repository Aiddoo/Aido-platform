import type { Provider } from "@nestjs/common";
import { getHttpClientToken } from "@nestjs/http-client";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { AdminEventNotifierPort } from "./application/ports/admin-event-notifier.port.js";
import { AdminNoticeUserReaderPort } from "./application/ports/admin-notice-user.reader.port.js";
import { AdminNotificationQueuePort } from "./application/ports/admin-notification-queue.port.js";
import { AdminNotifierPort } from "./application/ports/admin-notifier.port.js";
import { SignupStatsReaderPort } from "./application/ports/signup-stats.reader.port.js";
import { DispatchDailySignupSummaryUseCase } from "./application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { EnqueueSubscriptionEventUseCase } from "./application/use-cases/enqueue-subscription-event.use-case.js";
import { EnqueueUserRegisteredUseCase } from "./application/use-cases/enqueue-user-registered.use-case.js";
import { ResolveAdminNoticeUserUseCase } from "./application/use-cases/resolve-admin-notice-user.use-case.js";
import { SendAdminNotificationUseCase } from "./application/use-cases/send-admin-notification.use-case.js";
import { AdminEventNotifierAdapter } from "./infrastructure/adapters/admin-event-notifier.adapter.js";
import { AdminNotificationQueueAdapter } from "./infrastructure/adapters/admin-notification-queue.adapter.js";
import { selectAdminNotifier } from "./infrastructure/adapters/admin-notifier-selection.adapter.js";
import { AdminNotificationProcessor } from "./infrastructure/jobs/admin-notification.processor.js";
import { DailySignupSummaryScheduler } from "./infrastructure/jobs/daily-signup-summary.scheduler.js";
import { DrizzleAdminNoticeUserReader } from "./infrastructure/persistence/drizzle-admin-notice-user.reader.js";
import { DrizzleSignupStatsReader } from "./infrastructure/persistence/drizzle-signup-stats.reader.js";
import { operationsAdminNoticesConfig } from "./operations-admin-notices.config.js";

export const DISCORD_HTTP_CLIENT_NAME = "discord";

export const OPERATIONS_ADMIN_NOTICES_PROVIDERS = [
  { provide: AdminNotificationQueuePort, useClass: AdminNotificationQueueAdapter },
  { provide: SignupStatsReaderPort, useClass: DrizzleSignupStatsReader },
  { provide: AdminNoticeUserReaderPort, useClass: DrizzleAdminNoticeUserReader },
  // ADMIN_NOTIFIER_PROVIDER(비우면 배포 환경 기본값)로 어댑터를 고른다
  {
    provide: AdminNotifierPort,
    useFactory: selectAdminNotifier,
    inject: [
      operationsAdminNoticesConfig.KEY,
      getHttpClientToken(DISCORD_HTTP_CLIENT_NAME),
      OutboundPolicyRegistry,
      ClockPort,
    ],
  },
  provideUseCase(ResolveAdminNoticeUserUseCase, {
    userReader: AdminNoticeUserReaderPort,
    logger: loggerFor(ResolveAdminNoticeUserUseCase),
  }),
  provideUseCase(EnqueueUserRegisteredUseCase, {
    queue: AdminNotificationQueuePort,
    resolveUser: ResolveAdminNoticeUserUseCase,
  }),
  provideUseCase(EnqueueSubscriptionEventUseCase, {
    queue: AdminNotificationQueuePort,
    resolveUser: ResolveAdminNoticeUserUseCase,
  }),
  provideUseCase(SendAdminNotificationUseCase, {
    notifier: AdminNotifierPort,
    alert: OperationalAlertPort,
    logger: loggerFor(SendAdminNotificationUseCase),
  }),
  provideUseCase(DispatchDailySignupSummaryUseCase, {
    statsReader: SignupStatsReaderPort,
    queue: AdminNotificationQueuePort,
    clock: ClockPort,
    logger: loggerFor(DispatchDailySignupSummaryUseCase),
  }),
  provideUseCase(AdminEventNotifierAdapter, {
    enqueueUserRegistered: EnqueueUserRegisteredUseCase,
    enqueueSubscriptionEvent: EnqueueSubscriptionEventUseCase,
    logger: loggerFor(AdminEventNotifierAdapter),
  }),
  { provide: AdminEventNotifierPort, useExisting: AdminEventNotifierAdapter },
  AdminNotificationProcessor,
  DailySignupSummaryScheduler,
] satisfies Provider[];

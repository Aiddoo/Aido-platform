import { Logger, type FactoryProvider } from "@nestjs/common";

import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { AdminEventNotifier } from "./application/notifiers/notifications/admin-event.notifier.js";
import { ADMIN_NOTICE_USER_READER } from "./application/ports/notifications/admin-notice-user.reader.port.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/notifications/admin-notification-queue.port.js";
import { ADMIN_NOTIFIER } from "./application/ports/notifications/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/notifications/signup-stats.reader.port.js";
import { AdminNoticeUserResolver } from "./application/services/notifications/admin-notice-user.resolver.js";
import { DispatchDailySignupSummary } from "./application/use-cases/notifications/dispatch-daily-signup-summary.use-case.js";
import { EnqueueSubscriptionEvent } from "./application/use-cases/notifications/enqueue-subscription-event.use-case.js";
import { EnqueueUserRegistered } from "./application/use-cases/notifications/enqueue-user-registered.use-case.js";
import { SendAdminNotification } from "./application/use-cases/notifications/send-admin-notification.use-case.js";

export const adminEventNotifierProvider: FactoryProvider<AdminEventNotifier> = {
  provide: AdminEventNotifier,
  inject: [EnqueueUserRegistered, EnqueueSubscriptionEvent],
  useFactory: (
    enqueueUserRegistered: ConstructorParameters<
      typeof AdminEventNotifier
    >[0]["enqueueUserRegistered"],
    enqueueSubscriptionEvent: ConstructorParameters<
      typeof AdminEventNotifier
    >[0]["enqueueSubscriptionEvent"],
  ) =>
    new AdminEventNotifier({
      enqueueUserRegistered,
      enqueueSubscriptionEvent,
      logger: new Logger(AdminEventNotifier.name),
    }),
};

export const dispatchDailySignupSummaryProvider: FactoryProvider<DispatchDailySignupSummary> = {
  provide: DispatchDailySignupSummary,
  inject: [SIGNUP_STATS_READER, ADMIN_NOTIFICATION_QUEUE_PORT],
  useFactory: (
    reader: ConstructorParameters<typeof DispatchDailySignupSummary>[0]["reader"],
    queue: ConstructorParameters<typeof DispatchDailySignupSummary>[0]["queue"],
  ) =>
    new DispatchDailySignupSummary({
      reader,
      queue,
      logger: new Logger(DispatchDailySignupSummary.name),
    }),
};

export const adminNoticeUserResolverProvider: FactoryProvider<AdminNoticeUserResolver> = {
  provide: AdminNoticeUserResolver,
  inject: [ADMIN_NOTICE_USER_READER],
  useFactory: (reader: ConstructorParameters<typeof AdminNoticeUserResolver>[0]["reader"]) =>
    new AdminNoticeUserResolver({ reader, logger: new Logger(AdminNoticeUserResolver.name) }),
};

export const enqueueSubscriptionEventProvider: FactoryProvider<EnqueueSubscriptionEvent> = {
  provide: EnqueueSubscriptionEvent,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT, AdminNoticeUserResolver],
  useFactory: (
    queue: ConstructorParameters<typeof EnqueueSubscriptionEvent>[0]["queue"],
    users: ConstructorParameters<typeof EnqueueSubscriptionEvent>[0]["users"],
  ) => new EnqueueSubscriptionEvent({ queue, users }),
};

export const enqueueUserRegisteredProvider: FactoryProvider<EnqueueUserRegistered> = {
  provide: EnqueueUserRegistered,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT, AdminNoticeUserResolver],
  useFactory: (
    queue: ConstructorParameters<typeof EnqueueUserRegistered>[0]["queue"],
    users: ConstructorParameters<typeof EnqueueUserRegistered>[0]["users"],
  ) => new EnqueueUserRegistered({ queue, users }),
};

export const sendAdminNotificationProvider: FactoryProvider<SendAdminNotification> = {
  provide: SendAdminNotification,
  inject: [ADMIN_NOTIFIER, OPERATIONAL_ALERT],
  useFactory: (
    notifier: ConstructorParameters<typeof SendAdminNotification>[0]["notifier"],
    alert: OperationalAlertPort,
  ) =>
    new SendAdminNotification({
      notifier,
      alert,
      logger: new Logger(SendAdminNotification.name),
    }),
};

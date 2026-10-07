import { Logger, type FactoryProvider } from "@nestjs/common";

import { AdminEventNotifier } from "./application/notifiers/notifications/admin-event.notifier.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/notifications/admin-notification-queue.port.js";
import {
  ADMIN_NOTIFIER,
  PAYMENT_NOTIFIER,
} from "./application/ports/notifications/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/notifications/signup-stats.reader.port.js";
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

export const enqueueSubscriptionEventProvider: FactoryProvider<EnqueueSubscriptionEvent> = {
  provide: EnqueueSubscriptionEvent,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT],
  useFactory: (queue: ConstructorParameters<typeof EnqueueSubscriptionEvent>[0]["queue"]) =>
    new EnqueueSubscriptionEvent({ queue }),
};

export const enqueueUserRegisteredProvider: FactoryProvider<EnqueueUserRegistered> = {
  provide: EnqueueUserRegistered,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT],
  useFactory: (queue: ConstructorParameters<typeof EnqueueUserRegistered>[0]["queue"]) =>
    new EnqueueUserRegistered({ queue }),
};

export const sendAdminNotificationProvider: FactoryProvider<SendAdminNotification> = {
  provide: SendAdminNotification,
  inject: [ADMIN_NOTIFIER, PAYMENT_NOTIFIER],
  useFactory: (
    adminNotifier: ConstructorParameters<typeof SendAdminNotification>[0]["adminNotifier"],
    paymentNotifier: ConstructorParameters<typeof SendAdminNotification>[0]["paymentNotifier"],
  ) =>
    new SendAdminNotification({
      adminNotifier,
      paymentNotifier,
      logger: new Logger(SendAdminNotification.name),
    }),
};

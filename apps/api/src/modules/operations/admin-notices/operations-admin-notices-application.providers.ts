import { Logger, type FactoryProvider } from "@nestjs/common";

import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { ADMIN_NOTICE_USER_READER } from "./application/ports/admin-notice-user.reader.port.js";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "./application/ports/admin-notification-queue.port.js";
import { ADMIN_NOTIFIER } from "./application/ports/admin-notifier.port.js";
import { SIGNUP_STATS_READER } from "./application/ports/signup-stats.reader.port.js";
import { DispatchDailySignupSummaryUseCase } from "./application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { EnqueueSubscriptionEventUseCase } from "./application/use-cases/enqueue-subscription-event.use-case.js";
import { EnqueueUserRegisteredUseCase } from "./application/use-cases/enqueue-user-registered.use-case.js";
import { ResolveAdminNoticeUserUseCase } from "./application/use-cases/resolve-admin-notice-user.use-case.js";
import { SendAdminNotificationUseCase } from "./application/use-cases/send-admin-notification.use-case.js";
import { AdminEventNotifier } from "./infrastructure/adapters/admin-event-notifier.adapter.js";

export const adminEventNotifierProvider: FactoryProvider<AdminEventNotifier> = {
  provide: AdminEventNotifier,
  inject: [EnqueueUserRegisteredUseCase, EnqueueSubscriptionEventUseCase],
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

export const dispatchDailySignupSummaryProvider: FactoryProvider<DispatchDailySignupSummaryUseCase> =
  {
    provide: DispatchDailySignupSummaryUseCase,
    inject: [SIGNUP_STATS_READER, ADMIN_NOTIFICATION_QUEUE_PORT],
    useFactory: (
      reader: ConstructorParameters<typeof DispatchDailySignupSummaryUseCase>[0]["reader"],
      queue: ConstructorParameters<typeof DispatchDailySignupSummaryUseCase>[0]["queue"],
    ) =>
      new DispatchDailySignupSummaryUseCase({
        reader,
        queue,
        logger: new Logger(DispatchDailySignupSummaryUseCase.name),
      }),
  };

export const adminNoticeUserResolverProvider: FactoryProvider<ResolveAdminNoticeUserUseCase> = {
  provide: ResolveAdminNoticeUserUseCase,
  inject: [ADMIN_NOTICE_USER_READER],
  useFactory: (reader: ConstructorParameters<typeof ResolveAdminNoticeUserUseCase>[0]["reader"]) =>
    new ResolveAdminNoticeUserUseCase({
      reader,
      logger: new Logger(ResolveAdminNoticeUserUseCase.name),
    }),
};

export const enqueueSubscriptionEventProvider: FactoryProvider<EnqueueSubscriptionEventUseCase> = {
  provide: EnqueueSubscriptionEventUseCase,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT, ResolveAdminNoticeUserUseCase],
  useFactory: (
    queue: ConstructorParameters<typeof EnqueueSubscriptionEventUseCase>[0]["queue"],
    users: ConstructorParameters<typeof EnqueueSubscriptionEventUseCase>[0]["users"],
  ) => new EnqueueSubscriptionEventUseCase({ queue, users }),
};

export const enqueueUserRegisteredProvider: FactoryProvider<EnqueueUserRegisteredUseCase> = {
  provide: EnqueueUserRegisteredUseCase,
  inject: [ADMIN_NOTIFICATION_QUEUE_PORT, ResolveAdminNoticeUserUseCase],
  useFactory: (
    queue: ConstructorParameters<typeof EnqueueUserRegisteredUseCase>[0]["queue"],
    users: ConstructorParameters<typeof EnqueueUserRegisteredUseCase>[0]["users"],
  ) => new EnqueueUserRegisteredUseCase({ queue, users }),
};

export const sendAdminNotificationProvider: FactoryProvider<SendAdminNotificationUseCase> = {
  provide: SendAdminNotificationUseCase,
  inject: [ADMIN_NOTIFIER, OPERATIONAL_ALERT],
  useFactory: (
    notifier: ConstructorParameters<typeof SendAdminNotificationUseCase>[0]["notifier"],
    alert: OperationalAlertPort,
  ) =>
    new SendAdminNotificationUseCase({
      notifier,
      alert,
      logger: new Logger(SendAdminNotificationUseCase.name),
    }),
};

import { Logger, type FactoryProvider } from "@nestjs/common";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin/admin-broadcast-notifier.port.js";
import { ADMIN_GROWTH_METRICS } from "./application/ports/admin/admin-growth-metrics.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin/admin-user-directory.port.js";
import { BroadcastNotification } from "./application/use-cases/admin/broadcast-notification.use-case.js";
import { GetGrowthSummary } from "./application/use-cases/admin/get-growth-summary.use-case.js";
import { SendTargetedNotification } from "./application/use-cases/admin/send-targeted-notification.use-case.js";

export const getGrowthSummaryProvider: FactoryProvider<GetGrowthSummary> = {
  provide: GetGrowthSummary,
  inject: [ADMIN_GROWTH_METRICS],
  useFactory: (metrics: ConstructorParameters<typeof GetGrowthSummary>[0]["metrics"]) =>
    new GetGrowthSummary({ metrics }),
};

export const broadcastNotificationProvider: FactoryProvider<BroadcastNotification> = {
  provide: BroadcastNotification,
  inject: [ADMIN_USER_DIRECTORY, ADMIN_BROADCAST_NOTIFIER],
  useFactory: (
    userDirectory: ConstructorParameters<typeof BroadcastNotification>[0]["userDirectory"],
    notifier: ConstructorParameters<typeof BroadcastNotification>[0]["notifier"],
  ) =>
    new BroadcastNotification({
      userDirectory,
      notifier,
      logger: new Logger(BroadcastNotification.name),
    }),
};

export const sendTargetedNotificationProvider: FactoryProvider<SendTargetedNotification> = {
  provide: SendTargetedNotification,
  inject: [ADMIN_USER_DIRECTORY, ADMIN_BROADCAST_NOTIFIER],
  useFactory: (
    userDirectory: ConstructorParameters<typeof SendTargetedNotification>[0]["userDirectory"],
    notifier: ConstructorParameters<typeof SendTargetedNotification>[0]["notifier"],
  ) =>
    new SendTargetedNotification({
      userDirectory,
      notifier,
      logger: new Logger(SendTargetedNotification.name),
    }),
};

import { GetGrowthSummaryQuery } from "./queries/get-growth-summary/get-growth-summary.query.js";
import { BroadcastNotificationUseCase } from "./use-cases/broadcast-notification/broadcast-notification.use-case.js";
import { SendTargetedNotificationUseCase } from "./use-cases/send-targeted-notification/send-targeted-notification.use-case.js";

export const ADMIN_PROVIDERS = [
  BroadcastNotificationUseCase,
  SendTargetedNotificationUseCase,
  GetGrowthSummaryQuery,
] as const;

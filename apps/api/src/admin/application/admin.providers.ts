import { GetGrowthSummaryQuery } from "./queries/get-growth-summary/get-growth-summary.query";
import { BroadcastNotificationUseCase } from "./use-cases/broadcast-notification/broadcast-notification.use-case";
import { SendTargetedNotificationUseCase } from "./use-cases/send-targeted-notification/send-targeted-notification.use-case";

export const ADMIN_PROVIDERS = [
	BroadcastNotificationUseCase,
	SendTargetedNotificationUseCase,
	GetGrowthSummaryQuery,
] as const;

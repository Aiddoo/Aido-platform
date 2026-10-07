import {
  broadcastNotificationProvider,
  getGrowthSummaryProvider,
  sendTargetedNotificationProvider,
} from "./operations-admin-application.providers.js";

export const ADMIN_PROVIDERS = [
  broadcastNotificationProvider,
  sendTargetedNotificationProvider,
  getGrowthSummaryProvider,
] as const;

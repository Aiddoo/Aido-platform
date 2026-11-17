import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";

export const NOTIFICATION_DEDUPLICATION_SENTINEL = "__init__";
export const NOTIFICATION_DEDUPLICATION_TTL_MS = 25 * 60 * 60_000;

export const notificationDeduplicationKey = (
  type: NotificationType,
  notificationDate: Temporal.PlainDate,
): string => cacheKey("notification", "dedup-notified", type, notificationDate.toString());

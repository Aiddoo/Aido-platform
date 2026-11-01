import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";

export const NOTIFICATION_DEDUP_SENTINEL = "__init__";
export const NOTIFICATION_DEDUP_TTL_MS = 25 * 60 * 60_000;

export const notificationDedupKey = (type: NotificationType, notificationDate: Date): string =>
  cacheKey("notification", "dedup-notified", type, toDateString(notificationDate));

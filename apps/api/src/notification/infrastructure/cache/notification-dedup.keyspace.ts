import { cacheKey } from "@/shared/infrastructure/cache/keyspace/cache-key";

import type { NotificationType } from "../../domain/types/notification-type";

export const NOTIFICATION_DEDUP_SENTINEL = "__init__";
export const NOTIFICATION_DEDUP_TTL_MS = 25 * 60 * 60_000;

export const notificationDedupKey = (type: NotificationType, notificationDate: Date): string =>
	cacheKey("notification", "dedup-notified", type, notificationDate.toISOString().slice(0, 10));

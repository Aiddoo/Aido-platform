import { isPlainObject } from "es-toolkit";

import type { notification as notificationTable } from "#api/platform/database/schema/notification.schema";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { Notification } from "../../domain/notification.aggregate.js";

type NotificationRow = typeof notificationTable.$inferSelect;

// 컬럼은 아직 Date다. push·다른 Context가 같은 행을 Date로 읽어 이 경계에서만 Instant로 바꾼다
export function toNotification(row: NotificationRow): Notification {
  return Notification.reconstitute({
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    copyKey: row.copyKey,
    copyFacts: toCopyFacts(row.copyFacts),
    isRead: row.isRead,
    readAt: row.readAt == null ? null : instantFromDate(row.readAt),
    openedAt: row.openedAt == null ? null : instantFromDate(row.openedAt),
    createdAt: instantFromDate(row.createdAt),
  });
}

function toCopyFacts(value: unknown): Readonly<Record<string, unknown>> | null {
  return isPlainObject(value) ? value : null;
}

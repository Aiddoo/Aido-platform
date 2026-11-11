import { isPlainObject } from "es-toolkit";

import type { notification as notificationTable } from "#api/platform/database/schema/notification.schema";

import { Notification } from "../../domain/notification.aggregate.js";

type NotificationRow = typeof notificationTable.$inferSelect;

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
    readAt: row.readAt,
    openedAt: row.openedAt,
    createdAt: row.createdAt,
  });
}

function toCopyFacts(value: unknown): Readonly<Record<string, unknown>> | null {
  return isPlainObject(value) ? value : null;
}

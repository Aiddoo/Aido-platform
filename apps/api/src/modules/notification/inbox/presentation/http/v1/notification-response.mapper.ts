import {
  type NotificationContext,
  type NotificationInboxItem,
  type NotificationInboxResponse,
  type NotificationMetadata,
  notificationMetadataSchema,
} from "@aido/api/contracts/notification";

import type { CursorPage } from "#api/shared/application/cursor-page";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { toIsoString } from "#api/shared/domain/time/instant";

import { renderNotificationCopy } from "../../../../push/application/messages/notification-copy-render.messages.js";
import { toWireNotificationType } from "../../../../push/domain/notification-client-capability.domain-service.js";
import { toNotificationNavigation } from "../../../../push/infrastructure/adapters/notification-navigation.mapper.js";
import { toNotificationRouting } from "../../../../push/infrastructure/adapters/notification-routing.mapper.js";
import type { InboxNotification } from "../../../application/read-models/inbox-notification.read-model.js";

// 출시 앱이 표시하지는 않지만 계약 필드라 문구를 그대로 둔다
export const NOTIFICATION_RESPONSE_MESSAGES = {
  READ: "알림을 읽음 처리했습니다.",
  READ_ALL: "모든 알림을 읽음 처리했습니다.",
} as const;

export interface InboxCopySource {
  readonly title: string;
  readonly body: string;
  readonly copyKey: string | null;
  readonly copyFacts: unknown;
}

export interface InboxCopy {
  readonly title: string;
  readonly body: string;
}

// Accept-Language가 없는 옛 앱은 받는 사람의 저장 언어로 만든 문구를 그대로 받는다
export function renderInboxCopy(
  source: InboxCopySource,
  locale: SupportedLocale | null,
): InboxCopy {
  const stored = { title: source.title, body: source.body };
  if (locale == null || source.copyKey == null) {
    return stored;
  }
  return (
    renderNotificationCopy({ copyKey: source.copyKey, copyFacts: source.copyFacts }, locale) ??
    stored
  );
}

function toNotificationContext(notification: InboxNotification): NotificationContext | undefined {
  const context: NotificationContext = {};
  if (notification.todoId != null) {
    context.todoId = notification.todoId;
  }
  if (notification.friendId != null) {
    context.friendId = notification.friendId;
  }
  if (notification.nudgeId != null) {
    context.nudgeId = notification.nudgeId;
  }
  if (notification.cheerId != null) {
    context.cheerId = notification.cheerId;
  }
  return Object.keys(context).length > 0 ? context : undefined;
}

function toNotificationMetadata(metadata: unknown): NotificationMetadata {
  const result = notificationMetadataSchema.safeParse(metadata);
  return result.success ? result.data : null;
}

export function toNotificationResponse(
  notification: InboxNotification,
  locale: SupportedLocale | null,
): NotificationInboxItem {
  const context = toNotificationContext(notification);
  const action = {
    type: notification.actionType,
    ...(notification.actionUrl && { url: notification.actionUrl }),
  };
  const navigation = toNotificationNavigation({
    type: notification.type,
    action,
    todoId: notification.todoId,
    friendId: notification.friendId,
    nudgeId: notification.nudgeId,
    cheerId: notification.cheerId,
    routing: toNotificationRouting(notification.metadata),
  });
  const copy = renderInboxCopy(notification, locale);

  return {
    id: notification.id,
    userId: notification.userId,
    type: toWireNotificationType(notification.type),
    title: copy.title,
    body: copy.body,
    isRead: notification.isRead,
    metadata: toNotificationMetadata(notification.metadata),
    ...(context != null && { context }),
    action,
    ...(navigation != null && { navigation }),
    createdAt: toIsoString(notification.createdAt),
    readAt: notification.readAt == null ? null : toIsoString(notification.readAt),
  };
}

export function toNotificationInboxResponse(
  page: CursorPage<InboxNotification, number>,
  unreadCount: number,
  locale: SupportedLocale | null,
): NotificationInboxResponse {
  return {
    notifications: page.items.map((notification) => toNotificationResponse(notification, locale)),
    unreadCount,
    hasMore: page.pagination.hasNext,
    nextCursor: page.pagination.nextCursor,
  };
}

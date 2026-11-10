import {
  type NotificationContext,
  type NotificationInboxItem,
  type NotificationInboxResponse,
  type NotificationMetadata,
  notificationMetadataSchema,
} from "@aido/api/contracts/notification";

import type { CursorPage } from "#api/shared/application/cursor-page";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { toWireNotificationType } from "../../../../push/domain/notification-client-capability.domain-service.js";
import { toNotificationNavigation } from "../../../../push/domain/notification-navigation.domain-service.js";
import { toNotificationRouting } from "../../../../push/domain/notification-routing.domain-service.js";
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

// 요청 언어로 카피를 다시 그리는 자리다. 아직은 저장한 문구를 그대로 준다
export function renderInboxCopy(source: InboxCopySource, _locale: SupportedLocale): InboxCopy {
  return { title: source.title, body: source.body };
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
  locale: SupportedLocale,
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
    createdAt: toISOString(notification.createdAt),
    readAt: toISOStringOrNull(notification.readAt),
  };
}

export function toNotificationInboxResponse(
  page: CursorPage<InboxNotification, number>,
  unreadCount: number,
  locale: SupportedLocale,
): NotificationInboxResponse {
  return {
    notifications: page.items.map((notification) => toNotificationResponse(notification, locale)),
    unreadCount,
    hasMore: page.pagination.hasNext,
    nextCursor: page.pagination.nextCursor,
  };
}

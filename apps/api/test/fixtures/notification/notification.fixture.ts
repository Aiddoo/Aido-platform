import type { CreateNotificationData } from "#api/modules/notification/inbox/application/ports/notification-draft.port";
import type { InboxNotification } from "#api/modules/notification/inbox/application/read-models/inbox-notification.read-model";
import {
  Notification,
  type NotificationPrimitives,
} from "#api/modules/notification/inbox/domain/notification.aggregate";

export const NOTIFICATION_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const NOTIFICATION_FIXTURE_USER_ID = "clz7x5p8k0011qz0z8z8z8z8z";
export const NOTIFICATION_FIXTURE_OTHER_USER_ID = "clz7x5p8k0012qz0z8z8z8z8z";
export const NOTIFICATION_FIXTURE_ACTOR_ID = "clz7x5p8k0013qz0z8z8z8z8z";

export function createNotificationFixture(
  overrides: Partial<NotificationPrimitives> = {},
): Notification {
  return Notification.reconstitute({
    id: 1,
    userId: NOTIFICATION_FIXTURE_USER_ID,
    type: "FOLLOW_NEW",
    title: "새로운 알림",
    body: "알림 내용입니다",
    copyKey: null,
    copyFacts: null,
    isRead: false,
    readAt: null,
    openedAt: null,
    createdAt: NOTIFICATION_FIXTURE_NOW,
    ...overrides,
  });
}

// 알림함 행(Notification 테이블 한 줄)과 같은 모양이다
export function createInboxNotificationFixture(
  overrides: Partial<InboxNotification> = {},
): InboxNotification {
  return {
    id: 1,
    userId: NOTIFICATION_FIXTURE_USER_ID,
    type: "FOLLOW_NEW",
    title: "새로운 알림",
    body: "알림 내용입니다",
    copyKey: null,
    copyFacts: null,
    isRead: false,
    todoId: null,
    friendId: null,
    nudgeId: null,
    cheerId: null,
    notificationDate: null,
    metadata: null,
    createdAt: NOTIFICATION_FIXTURE_NOW,
    readAt: null,
    actionType: "DEEP_LINK",
    actionUrl: null,
    campaignKey: null,
    variantId: null,
    purpose: "TRANSACTIONAL",
    openedAt: null,
    ...overrides,
  };
}

export function createNotificationDraftFixture(
  overrides: Partial<CreateNotificationData> = {},
): CreateNotificationData {
  return {
    userId: NOTIFICATION_FIXTURE_USER_ID,
    type: "FOLLOW_NEW",
    title: "새로운 알림",
    body: "알림 내용입니다",
    ...overrides,
  };
}

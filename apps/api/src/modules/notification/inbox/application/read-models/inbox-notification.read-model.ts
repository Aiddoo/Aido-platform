import type { NOTIFICATION_PURPOSES, NotificationActionType } from "@aido/api/vocabulary";

import type { NotificationType } from "../../domain/notification-type.constants.js";

// Notification 행이 그대로 이 모양을 만족한다. metadata·copyFacts는 알림마다 모양이 달라 unknown이다
export interface InboxNotification {
  readonly id: number;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly copyKey: string | null;
  readonly copyFacts: unknown;
  readonly isRead: boolean;
  readonly todoId: number | null;
  readonly friendId: string | null;
  readonly nudgeId: number | null;
  readonly cheerId: number | null;
  readonly notificationDate: Temporal.PlainDate | null;
  readonly metadata: unknown;
  readonly createdAt: Temporal.Instant;
  readonly readAt: Temporal.Instant | null;
  readonly actionType: NotificationActionType;
  readonly actionUrl: string | null;
  readonly campaignKey: string | null;
  readonly variantId: string | null;
  readonly purpose: (typeof NOTIFICATION_PURPOSES)[number];
  readonly openedAt: Temporal.Instant | null;
}

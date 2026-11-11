import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../domain/notification-id.vo.js";
import type { NotificationType } from "../../domain/notification-type.constants.js";
import type { Notification } from "../../domain/notification.aggregate.js";
import type { InboxNotification } from "../read-models/inbox-notification.read-model.js";
import type { CreateNotificationData } from "./notification-draft.port.js";

export class DuplicateNotificationError extends Error {
  constructor() {
    super("Notification already exists");
    this.name = "DuplicateNotificationError";
  }
}

export abstract class NotificationRepositoryPort {
  abstract findById(notificationId: NotificationId): Promise<Notification | null>;
  abstract createNotification(data: CreateNotificationData): Promise<InboxNotification>;
  abstract createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<InboxNotification[]>;
  // 아직 읽지 않은 행에만 읽음을 반영한다. 동시 요청이 먼저 바꿨으면 false다
  abstract markAsRead(notification: Notification): Promise<boolean>;
  // 처음 연 기록만 남기고 읽음도 맞춘다. 남의 알림·없는 알림·이미 연 알림은 false다
  abstract markAsOpened(
    notificationId: NotificationId,
    userId: UserId,
    now: Temporal.Instant,
  ): Promise<boolean>;
  abstract markAllAsRead(
    userId: UserId,
    types: readonly NotificationType[] | undefined,
    now: Temporal.Instant,
  ): Promise<{ count: number }>;
  abstract deleteNotificationsByActorId(
    actorId: UserId,
  ): Promise<{ count: number; affectedUserIds: string[] }>;
}

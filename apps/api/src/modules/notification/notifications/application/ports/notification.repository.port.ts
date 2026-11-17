import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type { Notification } from "../../domain/notification.aggregate.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";

export abstract class NotificationRepositoryPort {
  abstract findById(notificationId: NotificationId): Promise<Notification | null>;
  // 아직 읽지 않은 행에만 읽음을 반영한다. 동시 요청이 먼저 바꿨으면 false다
  abstract save(notification: Notification): Promise<boolean>;
  // 아래는 집합 SQL이다. 묶음 발행·전체 읽음·탈퇴 정리는 수백 행을 한 문장으로 바꿔 Aggregate로 복원하지 않는다
  abstract createNotification(data: CreateNotificationData): Promise<InboxNotificationReadModel>;
  abstract createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<InboxNotificationReadModel[]>;
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
  // 보관 기간이 지난 알림을 만든 순서로 limit개 지운다. 발송 기록은 FK cascade로 함께 지워진다.
  // 한 번뿐인 마일스톤 알림은 다시 보내지 않는 근거라 남긴다. createdFrom부터 찾아 남긴 행을 다시 훑지 않는다
  abstract deleteCreatedBefore(query: {
    readonly createdBefore: Temporal.Instant;
    readonly createdFrom: Temporal.Instant | null;
    readonly limit: number;
  }): Promise<{ readonly deletedCount: number; readonly lastCreatedAt: Temporal.Instant | null }>;
}

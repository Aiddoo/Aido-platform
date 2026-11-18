import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";

export interface ListInboxNotificationsQuery {
  readonly userId: UserId;
  readonly afterNotificationId: NotificationId | null;
  readonly limit: number;
  readonly unreadOnly: boolean;
  readonly types: readonly NotificationType[] | undefined;
}

export abstract class NotificationInboxReaderPort {
  abstract findInboxNotification(
    notificationId: NotificationId,
  ): Promise<InboxNotificationReadModel | null>;
  // 최신순(createdAt·id 내림차순)이다. after 알림 뒤부터 주고 그 알림이 없으면 빈 목록이다
  abstract listByUser(query: ListInboxNotificationsQuery): Promise<InboxNotificationReadModel[]>;
  abstract countUnread(userId: UserId, types?: readonly NotificationType[]): Promise<number>;
  // 모든 종류를 센다. 안 읽은 알림이 없는 사람은 결과에 없다
  abstract countUnreadByUsers(userIds: readonly UserId[]): Promise<ReadonlyMap<string, number>>;
}

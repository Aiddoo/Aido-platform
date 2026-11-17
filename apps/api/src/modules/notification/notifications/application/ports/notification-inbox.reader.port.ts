import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type { NotificationId } from "../../domain/notification-id.vo.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";

export interface ListInboxNotificationsQuery {
  readonly userId: UserId;
  readonly afterNotificationId: NotificationId | null;
  readonly limit: number;
  readonly unreadOnly: boolean;
  readonly types: readonly NotificationType[] | undefined;
}

export abstract class NotificationInboxReaderPort {
  // 최신순(createdAt·id 내림차순)이다. after 알림 뒤부터 주고 그 알림이 없으면 빈 목록이다
  abstract listByUser(query: ListInboxNotificationsQuery): Promise<InboxNotificationReadModel[]>;
  abstract countUnread(userId: UserId, types?: readonly NotificationType[]): Promise<number>;
}

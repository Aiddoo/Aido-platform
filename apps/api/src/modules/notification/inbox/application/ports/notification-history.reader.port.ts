import type { NotificationMilestone } from "../../../push/domain/notification-milestone.constants.js";
import type { NotificationType } from "../../domain/notification-type.constants.js";

export interface ExistsRecentNotificationQuery {
  readonly userId: string;
  readonly type: NotificationType;
  readonly since: Temporal.Instant;
  readonly friendId?: string;
  readonly todoId?: number;
  readonly nudgeId?: number;
  readonly cheerId?: number;
}

export interface FindAlreadyNotifiedUserIdsQuery {
  readonly userIds: string[];
  readonly type: NotificationType;
  readonly notificationDate: Temporal.PlainDate;
  readonly friendId?: string;
}

// 중복 발송 판단에 쓰는 알림 이력 조회다
export abstract class NotificationHistoryReaderPort {
  abstract existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean>;
  abstract findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>>;
  abstract hasMilestoneNotification(
    userId: string,
    milestone: NotificationMilestone,
  ): Promise<boolean>;
}

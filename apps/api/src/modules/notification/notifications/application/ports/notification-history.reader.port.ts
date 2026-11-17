import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationMilestone } from "../../../shared/domain/notification-milestone.constants.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";

export interface ExistsRecentNotificationQuery {
  readonly userId: UserId;
  readonly type: NotificationType;
  readonly since: Temporal.Instant;
  readonly friendId?: UserId;
  readonly todoId?: TodoId;
  readonly nudgeId?: number;
  readonly cheerId?: number;
}

export interface FindAlreadyNotifiedUserIdsQuery {
  readonly userIds: readonly UserId[];
  readonly type: NotificationType;
  readonly notificationDate: Temporal.PlainDate;
  readonly friendId?: UserId;
}

// 중복 발송 판단에 쓰는 알림 이력 조회다
export abstract class NotificationHistoryReaderPort {
  abstract existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean>;
  abstract findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>>;
  abstract hasMilestoneNotification(
    userId: UserId,
    milestone: NotificationMilestone,
  ): Promise<boolean>;
}

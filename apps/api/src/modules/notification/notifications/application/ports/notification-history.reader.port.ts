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

export interface FindWinbackStagesSinceQuery {
  // 사용자마다 이 순간(마지막 활동) 뒤에 만든 알림만 센다
  readonly recipients: readonly { readonly userId: UserId; readonly since: Temporal.Instant }[];
}

export interface FindNudgeSuggestedFriendsQuery {
  readonly userIds: readonly UserId[];
  // 알림 날짜 [start, end)
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
}

// 중복 발송 판단에 쓰는 알림 이력 조회다
export abstract class NotificationHistoryReaderPort {
  abstract existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean>;
  abstract findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>>;
  // 사용자 id → 받은 WINBACK 단계(metadata.stage)
  abstract findWinbackStagesSince(
    query: FindWinbackStagesSinceQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
  // 사용자 id → 찔러보라고 제안받은 친구 id
  abstract findNudgeSuggestedFriends(
    query: FindNudgeSuggestedFriendsQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
  abstract hasMilestoneNotification(
    userId: UserId,
    milestone: NotificationMilestone,
  ): Promise<boolean>;
}

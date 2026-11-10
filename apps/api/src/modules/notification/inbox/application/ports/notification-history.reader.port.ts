import type { NotificationMilestone } from "../../../push/domain/notification-milestone.constants.js";
import type { NotificationType } from "../../domain/notification-type.constants.js";

// 옛 Symbol 토큰. 아직 Symbol로 주입하는 곳이 있어 같은 인스턴스로 묶어 둔다
export const NOTIFICATION_HISTORY_READER = Symbol("NOTIFICATION_HISTORY_READER");

export interface ExistsRecentNotificationQuery {
  readonly userId: string;
  readonly type: NotificationType;
  readonly since: Date;
  readonly friendId?: string;
  readonly todoId?: number;
  readonly nudgeId?: number;
  readonly cheerId?: number;
}

export interface FindAlreadyNotifiedUserIdsQuery {
  readonly userIds: string[];
  readonly type: NotificationType;
  readonly notificationDate: Date;
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

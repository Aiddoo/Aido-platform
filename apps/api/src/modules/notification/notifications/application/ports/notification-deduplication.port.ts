import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";

export interface NotificationDeduplicationEntry {
  readonly userId: UserId;
  readonly type: NotificationType;
  readonly notificationDate: Temporal.PlainDate;
}

// 날짜별 발송 중복 방지 기록
export abstract class NotificationDeduplicationPort {
  abstract recordNotifiedUsers(records: NotificationDeduplicationEntry[]): Promise<void>;
  abstract readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<Set<string> | null>;
  abstract warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<void>;
}

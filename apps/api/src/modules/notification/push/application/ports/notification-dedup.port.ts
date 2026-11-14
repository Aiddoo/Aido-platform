import type { NotificationType } from "../../../inbox/domain/notification-type.constants.js";

export interface NotificationDedupRecord {
  readonly userId: string;
  readonly type: NotificationType;
  readonly notificationDate: Temporal.PlainDate;
}

// 날짜별 발송 중복 방지 기록
export abstract class NotificationDedupPort {
  abstract recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void>;
  abstract readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<Set<string> | null>;
  abstract warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<void>;
}

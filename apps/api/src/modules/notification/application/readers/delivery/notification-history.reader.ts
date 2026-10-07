import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";
import type { FindAlreadyNotifiedUsers } from "../../use-cases/delivery/find-already-notified-users.use-case.js";

export interface FindAlreadyNotifiedRecipientsQuery {
  readonly userIds: string[];
  readonly type: NotificationType;
  readonly notificationDate: Date;
  readonly friendId?: string;
}

/** 캐시·DB fallback 세부사항을 숨기는 알림 발송 이력 조회 capability. */
export class NotificationHistoryReader {
  constructor(private readonly findAlreadyNotifiedUsers: FindAlreadyNotifiedUsers) {}

  findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedRecipientsQuery): Promise<Set<string>> {
    return this.findAlreadyNotifiedUsers.execute(query);
  }
}

import type { NotificationType } from "../../domain/notification-type.constants.js";
import type { InboxNotification } from "../read-models/inbox-notification.read-model.js";
import type { FindNotificationsParams } from "./notification-draft.port.js";

export const NOTIFICATION_INBOX_READER = Symbol("NOTIFICATION_INBOX_READER");

/** 알림함 화면과 읽음 처리에 필요한 조회 projection 포트. */
export interface NotificationInboxReaderPort {
  findNotificationById(id: number): Promise<InboxNotification | null>;
  findNotificationsByUser(params: FindNotificationsParams): Promise<InboxNotification[]>;
  countUnread(userId: string, types?: readonly NotificationType[]): Promise<number>;
}

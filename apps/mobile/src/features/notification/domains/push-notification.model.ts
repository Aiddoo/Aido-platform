import type { PushNotificationPayload } from '../schemas/push-notification-payload.schema';

/** 알림 ID가 0이면 서버에 알림 기록이 없는 푸시라 읽음·열림을 서버에 묻지 않는다. 서비스는 ID만 받아 값으로 묻는다 */
export function isServerNotificationId(notificationId: number) {
  return notificationId > 0;
}

function hasServerRecord(payload: PushNotificationPayload) {
  return isServerNotificationId(payload.notificationId);
}

/** 기기가 받은 푸시 */
export const PushNotificationPolicy = {
  hasServerRecord,
} as const;

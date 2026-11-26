import type { ForegroundPushPresentation } from '@src/core/ports/push-notification-gateway';

import { getNotificationReceiptRefresh } from '../domains/notification.model';
import type { PushNotification } from '../domains/push-notification.model';

/** 받을 때 다시 받는 화면을 보고 있으면 배너로 가리지 않고, 모르는 종류·다시 받지 않는 화면은 새 내용이 안 보여 배너로 알린다 */
export function getForegroundPushPresentation(
  pushNotification: PushNotification,
  {
    isViewingInbox,
    isViewingDestination,
  }: { isViewingInbox: boolean; isViewingDestination: boolean },
): ForegroundPushPresentation {
  if (pushNotification.type == null) {
    return 'banner';
  }
  const isRefreshedOnReceipt = getNotificationReceiptRefresh(pushNotification.type) != null;
  return isViewingInbox || (isViewingDestination && isRefreshedOnReceipt) ? 'quiet' : 'banner';
}

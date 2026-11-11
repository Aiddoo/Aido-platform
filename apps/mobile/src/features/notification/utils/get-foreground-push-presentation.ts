import type { ForegroundPushPresentation } from '@src/core/ports/push-notification-gateway';

import type { PushNotification } from '../domains/push-notification.model';
import { isRefreshedOnReceipt } from './notification-received-refresh';

/**
 * 앱이 앞에 있을 때 받은 알림을 보이는 방식. 알림함과 받은 종류의 화면은 받을 때 다시 받으므로, 그 화면을 보고 있으면
 * 배너·소리로 가리지 않고 알림 센터에만 남긴다. 모르는 종류와 다시 받지 않는 화면은 새 내용이 보이지 않아 배너로 알린다
 */
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
  return isViewingInbox || (isViewingDestination && isRefreshedOnReceipt(pushNotification.type))
    ? 'quiet'
    : 'banner';
}

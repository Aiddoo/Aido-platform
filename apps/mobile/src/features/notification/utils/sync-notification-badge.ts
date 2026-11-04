import type { Logger } from '@src/core/ports/logger';
import { errorMessageOf, isConnectivityError, toError } from '@src/shared/errors';

import type { NotificationService } from '../apis/notification.service';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import type { NotificationAuthStatus } from './navigation/notification-response-disposition';

interface SyncNotificationBadgeParams {
  authStatus: NotificationAuthStatus;
  isOnline: boolean;
  notificationService: Pick<NotificationService, 'syncBadgeCount' | 'clearBadge'>;
  logger: Logger;
}

/** 앱 아이콘 배지를 읽지 않은 알림 수에 맞춘다. 화면 뒤 작업이라 사용자에게 오류를 보이지 않는다 */
export const syncNotificationBadge = async ({
  authStatus,
  isOnline,
  notificationService,
  logger,
}: SyncNotificationBadgeParams): Promise<void> => {
  // 콜드 스타트의 인증 확인 중(loading·locked)은 로그아웃이 아니다. 지우면 읽지 않은 알림이 있어도 배지가 사라진다
  if (authStatus === 'loading' || authStatus === 'locked') {
    return;
  }

  if (authStatus === 'unauthenticated') {
    await notificationService
      .clearBadge()
      .catch((error) => logger.error(NOTIFICATION_LOG_EVENT.BADGE_CLEAR_FAILED, toError(error)));
    return;
  }

  // 오프라인이면 건너뛴다. 다시 연결되면 호출부가 한 번 더 맞춘다
  if (!isOnline) {
    return;
  }

  try {
    await notificationService.syncBadgeCount();
  } catch (error) {
    if (isConnectivityError(error)) {
      logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: errorMessageOf(error) });
      return;
    }
    logger.error(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, toError(error));
  }
};

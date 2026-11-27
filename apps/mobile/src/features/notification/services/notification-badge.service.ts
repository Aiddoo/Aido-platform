import type { AppLogger } from '@src/core/ports/app-logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { getErrorMessage } from '@src/shared/errors';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

interface NotificationBadgeServicePorts {
  badge: Pick<PushNotificationGateway, 'setBadgeCount'>;
  logger: AppLogger;
}

export class NotificationBadgeService {
  readonly #badge: Pick<PushNotificationGateway, 'setBadgeCount'>;
  readonly #logger: AppLogger;

  constructor({ badge, logger }: NotificationBadgeServicePorts) {
    this.#badge = badge;
    this.#logger = logger;
  }

  /** 읽지 않은 수는 알림함 조회 캐시 하나에서 받는다. 일부 Android 런처는 배지 호출을 거부해 경고로만 남긴다 */
  syncBadge = async ({
    authStatus,
    unreadCount,
  }: {
    authStatus: AuthStatus;
    unreadCount: number | undefined;
  }): Promise<void> => {
    const count = findBadgeCount(authStatus, unreadCount);
    if (count == null) {
      return;
    }
    await this.#badge
      .setBadgeCount(count)
      .catch((error: unknown) =>
        this.#logger.warn(
          count === 0
            ? NOTIFICATION_LOG_EVENT.BADGE_CLEAR_FAILED
            : NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED,
          { error: getErrorMessage(error) },
        ),
      );
  };
}

/** 앱 아이콘 배지에 쓸 수. null이면 배지를 건드리지 않는다 */
function findBadgeCount(authStatus: AuthStatus, unreadCount: number | undefined): number | null {
  // 콜드 스타트의 인증 확인 중(loading·locked)은 로그아웃이 아니다. 지우면 읽지 않은 알림이 있어도 배지가 사라진다
  if (authStatus === 'loading' || authStatus === 'locked') {
    return null;
  }
  if (authStatus === 'unauthenticated') {
    return 0;
  }
  return unreadCount ?? null;
}

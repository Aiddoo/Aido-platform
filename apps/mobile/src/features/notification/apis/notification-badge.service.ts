import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { getErrorMessage, isConnectivityError, toError } from '@src/shared/errors';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import type { NotificationService } from './notification.service';

interface NotificationBadgeServicePorts {
  badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>;
  notificationService: Pick<NotificationService, 'getUnreadCount'>;
  logger: Logger;
}

interface SyncBadgeInput {
  authStatus: AuthStatus;
  isOnline: boolean;
}

/** 앱 아이콘 배지(OS)를 읽지 않은 알림 수에 맞춘다 */
export class NotificationBadgeService {
  readonly #badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>;
  readonly #notificationService: Pick<NotificationService, 'getUnreadCount'>;
  readonly #logger: Logger;

  constructor({ badgeGateway, notificationService, logger }: NotificationBadgeServicePorts) {
    this.#badgeGateway = badgeGateway;
    this.#notificationService = notificationService;
    this.#logger = logger;
  }

  setBadgeCount = (count: number): Promise<void> => this.#badgeGateway.setBadgeCount(count);

  clearBadge = (): Promise<void> => this.#badgeGateway.setBadgeCount(0);

  syncBadgeCount = async (): Promise<void> => {
    const result = await this.#notificationService.getUnreadCount();
    if (result.ok) {
      await this.setBadgeCount(result.value);
    }
  };

  /** 앱 아이콘 배지를 읽지 않은 알림 수에 맞춘다. 화면 뒤 작업이라 사용자에게 오류를 보이지 않는다 */
  syncBadge = async ({ authStatus, isOnline }: SyncBadgeInput): Promise<void> => {
    // 콜드 스타트의 인증 확인 중(loading·locked)은 로그아웃이 아니다. 지우면 읽지 않은 알림이 있어도 배지가 사라진다
    if (authStatus === 'loading' || authStatus === 'locked') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      await this.clearBadge().catch((error) =>
        this.#logger.error(NOTIFICATION_LOG_EVENT.BADGE_CLEAR_FAILED, toError(error)),
      );
      return;
    }

    // 오프라인이면 건너뛴다. 다시 연결되면 호출부가 한 번 더 맞춘다
    if (!isOnline) {
      return;
    }

    try {
      await this.syncBadgeCount();
    } catch (error) {
      if (isConnectivityError(error)) {
        this.#logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
          error: getErrorMessage(error),
        });
        return;
      }
      this.#logger.error(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, toError(error));
    }
  };
}

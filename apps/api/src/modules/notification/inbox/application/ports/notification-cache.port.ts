import type { NotificationInboxScope } from "../../../push/domain/notification-client-capability.domain-service.js";

// 옛 Symbol 토큰. 아직 Symbol로 주입하는 곳이 있어 같은 인스턴스로 묶어 둔다
export const NOTIFICATION_CACHE = Symbol("NOTIFICATION_CACHE");

export abstract class NotificationCachePort {
  abstract wrapUnreadCount(
    userId: string,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number>;
  abstract invalidateUnreadCount(userId: string): Promise<void>;
  abstract invalidatePushTokens(userId: string): Promise<void>;
  // user-settings가 소유한 키다. 푸시 기기 보고가 시간대·언어 설정 행을 바꿀 때 함께 비운다
  abstract invalidateUserPreference(userId: string): Promise<void>;
}

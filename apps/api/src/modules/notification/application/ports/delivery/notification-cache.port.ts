export const NOTIFICATION_CACHE = Symbol("NOTIFICATION_CACHE");

export interface NotificationCachePort {
  /** 미읽음 알림 개수 조회 (캐시 wrap). */
  wrapUnreadCount(
    userId: string,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number>;

  /** 미읽음 알림 개수 캐시 무효화 (읽음/신규 알림 쓰기 경로). */
  invalidateUnreadCount(userId: string): Promise<void>;

  /** 푸시 토큰 목록 캐시 무효화 (토큰 등록/해제 쓰기 경로). */
  invalidatePushTokens(userId: string): Promise<void>;

  /**
   * 사용자 설정 캐시 무효화 (크로스모듈 — user-settings 소유 키).
   * 푸시 토큰 등록이 타임존/로케일 등 설정 행을 변경할 때 코히런스 유지.
   */
  invalidateUserPreference(userId: string): Promise<void>;
}
import type { NotificationInboxScope } from "../../../domain/services/delivery/notification-client-capability.js";

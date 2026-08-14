export const NOTIFICATION_CACHE = Symbol("NOTIFICATION_CACHE");

/**
 * Notification 관련 캐시 포트 (cache 인프라 경계)
 *
 * application 계층은 공유 CacheService 대신 이 포트에만 의존한다. 키 관리·TTL은
 * 어댑터(→CacheService/CacheKeys)가 소유하고, 여기서는 알림 시맨틱만 노출한다.
 *
 * 미읽음 카운트·푸시 토큰 캐시는 도메인 이벤트가 없는 쓰기 경로에서 명시적으로
 * 무효화된다. `invalidateUserPreference`는 user-settings 소유 키에 대한 크로스모듈
 * 무효화로, 푸시 토큰 등록이 사용자 설정 행을 생성/변경할 때 코히런스를 유지한다.
 */
export interface NotificationCachePort {
	/** 미읽음 알림 개수 조회 (캐시 wrap). */
	wrapUnreadCount(userId: string, factory: () => Promise<number>): Promise<number>;

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

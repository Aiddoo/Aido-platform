/**
 * 캐시 키 상수 및 빌더
 *
 * 모든 캐시 키를 중앙에서 관리하여 일관성 유지
 */
export const CacheKeys = {
	// TTL 상수 (밀리초)
	TTL: {
		/** 세션 검증 - 30초 (보안상 짧게 유지) */
		SESSION: 30_000,
		/** 사용자 프로필 - 5분 */
		USER_PROFILE: 5 * 60_000,
		/** 구독 상태 - 10분 */
		SUBSCRIPTION: 10 * 60_000,
		/** 친구 관계 - 1분 (실시간성 중요) */
		MUTUAL_FRIEND: 60_000,
	},

	// === 키 빌더 ===

	/**
	 * 세션 캐시 키
	 * @example session:sess_abc123
	 */
	session: (sessionId: string) => `session:${sessionId}`,

	/**
	 * 사용자 프로필 캐시 키
	 * @example user:profile:user_123
	 */
	userProfile: (userId: string) => `user:profile:${userId}`,

	/**
	 * 구독 상태 캐시 키
	 * @example user:subscription:user_123
	 */
	subscription: (userId: string) => `user:subscription:${userId}`,

	/**
	 * 상호 친구 관계 캐시 키
	 * @example friends:mutual:user_1:user_2
	 */
	mutualFriend: (userId: string, targetUserId: string) =>
		`friends:mutual:${userId}:${targetUserId}`,

	// === 패턴 빌더 (와일드카드) ===

	/**
	 * 특정 사용자의 모든 친구 관계 캐시 패턴
	 * @example friends:mutual:user_1:*
	 */
	mutualFriendPattern: (userId: string) => `friends:mutual:${userId}:*`,
} as const;

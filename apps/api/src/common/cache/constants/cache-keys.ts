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
		/** 카테고리 목록 - 5분 (변경 빈도 낮음) */
		TODO_CATEGORIES: 5 * 60_000,
		/** 친구 ID 목록 - 5분 (알림 발송용, 변경 빈도 낮음) */
		MUTUAL_FRIEND_IDS: 5 * 60_000,
		/** 푸시 토큰 - 5분 (토큰 변경 빈도 낮음) */
		PUSH_TOKENS: 5 * 60_000,
		/** 사용자 설정 - 10분 (설정 변경 빈도 낮음) */
		USER_PREFERENCE: 10 * 60_000,
		/** 친구 수 - 5분 (친구 변경 빈도 낮음) */
		FRIEND_COUNT: 5 * 60_000,
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

	/**
	 * 카테고리 목록 캐시 키
	 * @example category:list:user_123
	 */
	todoCategories: (userId: string) => `category:list:${userId}`,

	/**
	 * 친구 ID 목록 캐시 키
	 * @example friends:ids:user_123
	 */
	mutualFriendIds: (userId: string) => `friends:ids:${userId}`,

	/**
	 * 푸시 토큰 캐시 키
	 * @example push:tokens:user_123
	 */
	pushTokens: (userId: string) => `push:tokens:${userId}`,

	/**
	 * 사용자 설정 캐시 키
	 * @example user:preference:user_123
	 */
	userPreference: (userId: string) => `user:preference:${userId}`,

	/**
	 * 친구 수 캐시 키
	 * @example friends:count:user_123
	 */
	friendCount: (userId: string) => `friends:count:${userId}`,

	// === 패턴 빌더 (와일드카드) ===

	/**
	 * 특정 사용자의 모든 친구 관계 캐시 패턴
	 * @example friends:mutual:user_1:*
	 */
	mutualFriendPattern: (userId: string) => `friends:mutual:${userId}:*`,
} as const;

import { cacheKey, cachePattern } from "../keyspace/cache-key";

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
		/** 읽지 않은 알림 수 - 2분 (실시간성 덜 중요) */
		UNREAD_COUNT: 2 * 60_000,
		/** 활성 타임존 목록 - 5분 (타임존 변경 빈도 매우 낮음) */
		ACTIVE_TIMEZONES: 5 * 60_000,
		/** 날씨 예보 - 3시간 (기상청 갱신 주기) */
		WEATHER_FORECAST: 3 * 60 * 60_000,
		/** 날씨 예보 최신 fallback - 24시간 (KMA 장애 대비) */
		WEATHER_FORECAST_LATEST: 24 * 60 * 60_000,
		/** 날씨 부가 정보 - 1시간 (미세먼지 실시간성 기준) */
		WEATHER_CONDITIONS: 60 * 60_000,
		/**
		 * 친구 공개 투두 첫 페이지 - 60초.
		 * 명시적 무효화(소유자 쓰기 시)가 1차 수단이고, TTL은 Redis 블립으로
		 * DEL이 유실됐을 때의 staleness 상한 + 메모리 상한 백스톱이다.
		 */
		TODO_FRIEND_VIEW: 60_000,
		/**
		 * 일별 완료 현황(달력 집계) - 10분.
		 * 과거일은 사실상 불변이고 오늘만 변하며, 투두 쓰기 이벤트가
		 * 명시적으로 무효화한다.
		 */
		DAILY_COMPLETIONS: 10 * 60_000,
	},

	// === 키 빌더 ===

	/**
	 * 세션 캐시 키
	 * @example session:sess_abc123
	 */
	session: (sessionId: string) => cacheKey("auth", "session", sessionId),

	/**
	 * 사용자 프로필 캐시 키
	 * @example user:profile:user_123
	 */
	userProfile: (userId: string) => cacheKey("auth", "user-profile", userId),

	/**
	 * 구독 상태 캐시 키
	 * @example user:subscription:user_123
	 */
	subscription: (userId: string) => cacheKey("subscription", "status", userId),

	/**
	 * 상호 친구 관계 캐시 키
	 * @example friends:mutual:user_1:user_2
	 */
	mutualFriend: (userId: string, targetUserId: string) =>
		cacheKey("follow", "mutual", userId, targetUserId),

	/**
	 * 카테고리 목록 캐시 키
	 * @example category:list:user_123
	 */
	todoCategories: (userId: string) => cacheKey("todo-category", "list", userId),

	/**
	 * 친구 ID 목록 캐시 키
	 * @example friends:ids:user_123
	 */
	mutualFriendIds: (userId: string) => cacheKey("follow", "ids", userId),

	/**
	 * 푸시 토큰 캐시 키
	 * @example push:tokens:user_123
	 */
	pushTokens: (userId: string) =>
		cacheKey("notification", "push-tokens", userId),

	/**
	 * 사용자 설정 캐시 키
	 * @example user:preference:user_123
	 */
	userPreference: (userId: string) =>
		cacheKey("user-settings", "preference", userId),

	/**
	 * 친구 수 캐시 키
	 * @example friends:count:user_123
	 */
	friendCount: (userId: string) => cacheKey("follow", "count", userId),

	/**
	 * 읽지 않은 알림 수 캐시 키
	 * @example notification:unread:user_123
	 */
	unreadCount: (userId: string) =>
		cacheKey("notification", "unread-count", userId),

	/**
	 * 활성 타임존 목록 캐시 키 (pushEnabled=true 유저만)
	 * @example scheduler:active-tz
	 */
	activeTimezones: () => cacheKey("scheduler", "active-timezones"),

	/**
	 * 전체 유저 타임존 목록 캐시 키 (pushEnabled 무관)
	 * @example scheduler:all-tz
	 */
	allTimezones: () => cacheKey("scheduler", "all-timezones"),

	/**
	 * 날씨 예보 캐시 키 (격자 + 발표시간 기준)
	 * @example weather:forecast:60:127:20260401:0800
	 */
	weatherForecast: (
		gridX: number,
		gridY: number,
		baseDate: string,
		baseTime: string,
	) =>
		cacheKey(
			"weather",
			"forecast",
			String(gridX),
			String(gridY),
			baseDate,
			baseTime,
		),

	/**
	 * 날씨 예보 최신 fallback 캐시 키 (격자 기준, 발표시간 무관)
	 * @example weather:forecast:latest:60:127
	 */
	weatherForecastLatest: (gridX: number, gridY: number) =>
		cacheKey("weather", "forecast-latest", String(gridX), String(gridY)),

	/**
	 * 날씨 부가 정보 캐시 키 (격자 기준)
	 * @example weather:conditions:60:127
	 */
	weatherConditions: (gridX: number, gridY: number) =>
		cacheKey("weather", "conditions", String(gridX), String(gridY)),

	/**
	 * 친구 공개 투두 첫 페이지 캐시 키 (v1 = 페이로드 스키마 버전)
	 *
	 * 날짜 세그먼트는 호출 측이 정규화한 문자열(YYYY-MM-DD, 없으면 "-").
	 * 커서 페이지는 캐싱하지 않으므로 커서 세그먼트가 없다.
	 * @example todo:friend-view:v1:user_1:2026-07-01:2026-07-31:20
	 */
	friendTodosFirstPage: (
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
	) =>
		cacheKey(
			"todo",
			"friend-view-v1",
			ownerUserId,
			startDate,
			endDate,
			String(size),
		),

	/**
	 * 일별 완료 현황 캐시 키 (v1 = 페이로드 스키마 버전)
	 * @example daily-completion:range:v1:user_1:2026-07-01:2026-07-31
	 */
	dailyCompletionRange: (userId: string, startDate: string, endDate: string) =>
		cacheKey("daily-completion", "range-v1", userId, startDate, endDate),

	/**
	 * 친구에게 보이는 공개(PUBLIC) 일별 완료 현황 캐시 키 — 소유자 기준.
	 * userId 뒤 세그먼트라 dailyCompletionPattern(소유자) 무효화에 함께 걸린다.
	 * @example daily-completion:range:v1:user_1:public:2026-07-01:2026-07-31
	 */
	dailyCompletionPublicRange: (
		ownerUserId: string,
		startDate: string,
		endDate: string,
	) =>
		cacheKey(
			"daily-completion",
			"range-v1",
			ownerUserId,
			"public",
			startDate,
			endDate,
		),

	// === 패턴 빌더 (와일드카드) ===

	/**
	 * 특정 격자의 모든 날씨 예보 캐시 패턴
	 * @example weather:forecast:60:127:*
	 */
	weatherForecastPattern: (gridX: number, gridY: number) =>
		cachePattern("weather", "forecast", String(gridX), String(gridY)),

	/**
	 * 특정 사용자의 모든 친구 관계 캐시 패턴
	 * @example friends:mutual:user_1:*
	 */
	mutualFriendPattern: (userId: string) =>
		cachePattern("follow", "mutual", userId),

	/**
	 * 특정 소유자의 친구 공개 투두 캐시 전체 패턴
	 * @example todo:friend-view:v1:user_1:*
	 */
	friendTodosPattern: (ownerUserId: string) =>
		cachePattern("todo", "friend-view-v1", ownerUserId),

	/**
	 * 특정 사용자의 일별 완료 현황 캐시 전체 패턴
	 * @example daily-completion:range:v1:user_1:*
	 */
	dailyCompletionPattern: (userId: string) =>
		cachePattern("daily-completion", "range-v1", userId),
} as const;

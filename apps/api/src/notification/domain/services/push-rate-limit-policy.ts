/** 푸시 피로도 제한 정책의 단일 원본. */
export const PUSH_RATE_LIMIT_POLICY = {
	GENERAL: {
		WINDOW_MS: 60 * 60 * 1000,
		MAX: 15,
	},
	ENGAGEMENT: {
		MIN_INTERVAL_MS: 4 * 60 * 60 * 1000,
		DAILY_MAX: 2,
		RETENTION_MS: 48 * 60 * 60 * 1000,
		TTL_SECONDS: 48 * 60 * 60,
	},
} as const;

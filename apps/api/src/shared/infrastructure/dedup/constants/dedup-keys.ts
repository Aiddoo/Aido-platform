import { cacheKey } from "../../cache/keyspace/cache-key";

/**
 * Dedup 키 상수 및 빌더
 *
 * CacheKeys와 동일한 패턴으로 모든 dedup 키를 중앙 관리.
 * RedisDedupAdapter가 'dedup:' prefix를 자동 부여하므로 여기서는 논리 키만 정의.
 */
export const DedupKeys = {
	/**
	 * Sentinel 멤버 — Set 초기화 여부를 원자적으로 확인
	 *
	 * filterMembers([SENTINEL, ...userIds]) 결과에 SENTINEL이 포함되면
	 * "이 Set은 warm 상태" → Redis 결과 신뢰.
	 * 포함되지 않으면 "cold start" → DB fallback + warm-up.
	 */
	SENTINEL: "__init__",

	// TTL 상수 (밀리초)
	TTL: {
		/** 알림 중복 방지 — 25시간 (일간 알림, 타임존 차이 고려) */
		NOTIFIED: 25 * 60 * 60_000,
		/** Winback 단계 추적 — 90일 */
		WINBACK_STAGES: 90 * 24 * 60 * 60_000,
		/** NudgeSuggest 주간 이력 — 8일 (주간 롤링) */
		NUDGE_SUGGEST: 8 * 24 * 60 * 60_000,
	},

	// === 키 빌더 ===

	/**
	 * 알림 중복 방지 키
	 * @example notified:MORNING_REMINDER:2026-03-09
	 */
	notified: (type: string, date: Date) =>
		cacheKey(
			"notification",
			"dedup-notified",
			type,
			date.toISOString().slice(0, 10),
		),

	/**
	 * Winback 단계 추적 키 (per-user)
	 * @example winback:stages:user_123
	 */
	winbackStages: (userId: string) =>
		cacheKey("scheduler", "dedup-winback-stages", userId),

	/**
	 * NudgeSuggest 주간 발송 이력 키 (per-week, 멤버: userId:friendId)
	 * @example nudge-suggest:sent:2026-W10
	 */
	nudgeSuggestSent: (weekId: string) =>
		cacheKey("scheduler", "dedup-nudge-suggest", weekId),
} as const;

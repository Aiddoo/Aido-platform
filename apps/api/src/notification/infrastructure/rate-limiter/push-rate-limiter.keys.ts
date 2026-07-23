/**
 * 푸시 레이트리미터 Redis 키 (모듈 로컬 중앙 관리)
 *
 * DedupKeys 패턴을 따르되, 이 키들은 공유 CacheService 키스페이스가 아니라
 * REDIS_COMMAND_CLIENT의 raw 키스페이스(ZSET/HASH, Lua 스크립트 대상)에 산다.
 * 따라서 `cacheKey()`(네임스페이스 접두어 부여)를 쓰지 않고 문자열을 그대로 노출한다.
 *
 * **라이브 데이터 호환**: 키 문자열은 byte-identical하게 유지해야 한다 — 변경 시
 * 기존 슬라이딩 윈도우/인게이지먼트 카운터가 유실된다(윈도우가 짧아 자기 치유되긴 하나
 * 불필요한 리셋을 피한다).
 */
export const PushRateLimiterKeys = {
	/**
	 * 일반 푸시 슬라이딩 윈도우 키 (per-user)
	 * @example push-rate:user_123
	 */
	general: (userId: string): string => `push-rate:${userId}`,

	/**
	 * 인게이지먼트(재참여) 레이트리미트 키 (per-user, per-local-date)
	 * @example push-engagement:user_123:2026-03-09
	 */
	engagement: (userId: string, localDate: string): string =>
		`push-engagement:${userId}:${localDate}`,

	/**
	 * 인게이지먼트가 없는 배치 슬롯의 placeholder 키 (Lua 인자 정렬용, 미사용 슬롯)
	 * @example push-engagement:unused:0
	 */
	engagementPlaceholder: (index: number): string =>
		`push-engagement:unused:${index}`,
} as const;

/**
 * FollowCachePort — 친구 관계 캐시 포트 (cache-aside).
 *
 * 캐싱 전략(실무 기준): **읽기 빈도는 높고 변경 빈도는 낮은** 친구 관계 사실만 캐싱한다.
 * - 맞팔 여부(mutualFriend): 친구-투두 열람·응원·콕찌르기 경로에서 매우 자주 조회되고,
 *   관계가 성립/해제될 때만 바뀐다 → 캐시 적합.
 * - 맞팔 친구 ID 목록(mutualFriendIds): 알림 팬아웃에서 자주 쓰이고 변경이 드묾 → 적합.
 * - 친구 수(friendCount): 리소스 한도 체크·목록 헤더에서 반복 조회 → 적합.
 *
 * 반대로 친구 요청 목록·페이지네이션 결과처럼 자주 바뀌고 커서 조합이 많은 데이터는
 * 캐싱하지 않는다(캐시 낭비·정합성 부담). 무효화는 관계 변경 use-case에서 즉시 수행한다.
 *
 * 캐시 키는 shared CacheKeys 상수로 중앙 관리되며, 어댑터가 CacheService에 위임한다.
 */

export const FOLLOW_CACHE = Symbol("FOLLOW_CACHE");

export interface FollowCachePort {
	/** 맞팔 여부 조회 (미스 시 undefined) — 키는 호출부가 정규화한 (smaller, larger) */
	getMutualFriend(
		smallerId: string,
		largerId: string,
	): Promise<boolean | undefined>;
	/** 맞팔 여부 캐싱 */
	setMutualFriend(
		smallerId: string,
		largerId: string,
		isMutual: boolean,
	): Promise<void>;
	/** 두 사용자 간 맞팔 여부 캐시 무효화 (내부 정규화) */
	invalidateMutualFriend(userId: string, targetUserId: string): Promise<void>;

	/** 맞팔 친구 ID 목록 read-through */
	wrapMutualFriendIds(
		userId: string,
		factory: () => Promise<string[]>,
	): Promise<string[]>;
	invalidateMutualFriendIds(userId: string): Promise<void>;

	/** 친구 수 read-through */
	wrapFriendCount(
		userId: string,
		factory: () => Promise<number>,
	): Promise<number>;
	invalidateFriendCount(userId: string): Promise<void>;
}

import { Inject, Injectable } from "@nestjs/common";
import { CacheKeys } from "./constants/cache-keys";
import {
	CACHE_SERVICE,
	type CacheStats,
	type ICacheService,
} from "./interfaces/cache.interface";

/**
 * 세션 캐시 데이터 타입
 */
export interface CachedSession {
	userId: string;
	expiresAt: Date;
	revokedAt: Date | null;
}

/**
 * 사용자 프로필 캐시 데이터 타입
 */
export interface CachedUserProfile {
	id: string;
	email: string;
	name: string;
	userTag: string;
}

/**
 * 구독 상태 캐시 데이터 타입
 */
export interface CachedSubscription {
	status: "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED" | null;
}

/**
 * 캐시 서비스 Facade
 *
 * - ICacheService 어댑터를 래핑
 * - 도메인별 타입 안전한 메서드 제공
 * - 캐시 키와 TTL 관리 중앙화
 */
@Injectable()
export class CacheService {
	constructor(@Inject(CACHE_SERVICE) private readonly cache: ICacheService) {}

	// === Generic Methods ===

	get<T>(key: string): Promise<T | undefined> {
		return this.cache.get<T>(key);
	}

	set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
		return this.cache.set(key, value, ttlMs);
	}

	del(key: string): Promise<void> {
		return this.cache.del(key);
	}

	delByPattern(pattern: string): Promise<number> {
		return this.cache.delByPattern(pattern);
	}

	reset(): Promise<void> {
		return this.cache.reset();
	}

	getStats(): CacheStats {
		return this.cache.getStats();
	}

	// === Session Methods ===

	async getSession(sessionId: string): Promise<CachedSession | undefined> {
		return this.get<CachedSession>(CacheKeys.session(sessionId));
	}

	async setSession(sessionId: string, session: CachedSession): Promise<void> {
		return this.set(
			CacheKeys.session(sessionId),
			session,
			CacheKeys.TTL.SESSION,
		);
	}

	async invalidateSession(sessionId: string): Promise<void> {
		return this.del(CacheKeys.session(sessionId));
	}

	// === User Profile Methods ===

	async getUserProfile(userId: string): Promise<CachedUserProfile | undefined> {
		return this.get<CachedUserProfile>(CacheKeys.userProfile(userId));
	}

	async setUserProfile(
		userId: string,
		profile: CachedUserProfile,
	): Promise<void> {
		return this.set(
			CacheKeys.userProfile(userId),
			profile,
			CacheKeys.TTL.USER_PROFILE,
		);
	}

	async invalidateUserProfile(userId: string): Promise<void> {
		return this.del(CacheKeys.userProfile(userId));
	}

	// === Subscription Methods ===

	async getSubscription(
		userId: string,
	): Promise<CachedSubscription | undefined> {
		return this.get<CachedSubscription>(CacheKeys.subscription(userId));
	}

	async setSubscription(
		userId: string,
		subscription: CachedSubscription,
	): Promise<void> {
		return this.set(
			CacheKeys.subscription(userId),
			subscription,
			CacheKeys.TTL.SUBSCRIPTION,
		);
	}

	async invalidateSubscription(userId: string): Promise<void> {
		return this.del(CacheKeys.subscription(userId));
	}

	// === Friend Relation Methods ===

	async getMutualFriend(
		userId: string,
		targetUserId: string,
	): Promise<boolean | undefined> {
		return this.get<boolean>(CacheKeys.mutualFriend(userId, targetUserId));
	}

	async setMutualFriend(
		userId: string,
		targetUserId: string,
		isMutual: boolean,
	): Promise<void> {
		return this.set(
			CacheKeys.mutualFriend(userId, targetUserId),
			isMutual,
			CacheKeys.TTL.MUTUAL_FRIEND,
		);
	}

	async invalidateFriendRelations(userId: string): Promise<number> {
		return this.delByPattern(CacheKeys.mutualFriendPattern(userId));
	}

	/**
	 * 특정 두 사용자 간의 친구 관계 캐시 무효화
	 * 내부적으로 ID를 정규화하여 일관된 캐시 키 생성
	 */
	async invalidateMutualFriend(
		userId: string,
		targetUserId: string,
	): Promise<void> {
		const [smallerId, largerId] =
			userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];
		return this.del(CacheKeys.mutualFriend(smallerId, largerId));
	}
}

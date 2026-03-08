import { Inject, Injectable } from "@nestjs/common";
import {
	AccountProvider,
	SubscriptionStatus,
	UserRole,
	UserStatus,
} from "@/generated/prisma/enums";
import type { TodoCategoryWithCount } from "@/modules/todo-category/types/todo-category.types";
import { CacheKeys } from "./constants/cache-keys";
import {
	CACHE_SERVICE,
	type CacheStats,
	type ICacheService,
	type TtlValue,
} from "./interfaces/cache.interface";

export interface CachedSession {
	userId: string;
	expiresAt: Date;
	revokedAt: Date | null;
	userStatus?: string;
	userDeletedAt?: string | null;
}

export interface CachedUserProfile {
	id: string;
	email: string;
	userTag: string;
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: string | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: string | null;
	name: string | null;
	profileImage: string | null;
	createdAt: string;
	providers: AccountProvider[];
}

export interface CachedSubscription {
	status: SubscriptionStatus | null;
	isAdmin?: boolean;
}

export interface CachedUserPreference {
	pushEnabled: boolean;
	nightPushEnabled: boolean;
	timezone: string;
	morningReminderHour: number;
	morningReminderMinute: number;
	eveningReminderHour: number;
	eveningReminderMinute: number;
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

	set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
		return this.cache.set(key, value, ttl);
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

	// === New Generic Methods ===

	/**
	 * Cache-aside 패턴 (wrap)
	 *
	 * 캐시에 데이터가 있으면 반환, 없으면 factory 실행 후 캐싱
	 */
	wrap<T>(key: string, factory: () => Promise<T>, ttl?: TtlValue): Promise<T> {
		return this.cache.wrap(key, factory, ttl);
	}

	mget<T>(keys: string[]): Promise<(T | undefined)[]> {
		return this.cache.mget<T>(keys);
	}

	mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void> {
		return this.cache.mset(entries);
	}

	has(key: string): Promise<boolean> {
		return this.cache.has(key);
	}

	/**
	 * 키의 남은 TTL 조회 (밀리초)
	 *
	 * @returns 남은 밀리초, -1 (TTL 없음), -2 (키 없음)
	 */
	ttl(key: string): Promise<number> {
		return this.cache.ttl(key);
	}

	/**
	 * 키의 TTL 갱신
	 *
	 * @returns 성공 시 true, 키가 없으면 false
	 */
	touch(key: string, ttl: TtlValue): Promise<boolean> {
		return this.cache.touch(key, ttl);
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

	/**
	 * 세션 wrap - 캐시에 없으면 factory 실행 후 캐싱
	 */
	async wrapSession(
		sessionId: string,
		factory: () => Promise<CachedSession | undefined>,
	): Promise<CachedSession | undefined> {
		return this.wrap(
			CacheKeys.session(sessionId),
			factory,
			CacheKeys.TTL.SESSION,
		);
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

	/**
	 * 사용자 프로필 wrap - 캐시에 없으면 factory 실행 후 캐싱
	 */
	async wrapUserProfile(
		userId: string,
		factory: () => Promise<CachedUserProfile | undefined>,
	): Promise<CachedUserProfile | undefined> {
		return this.wrap(
			CacheKeys.userProfile(userId),
			factory,
			CacheKeys.TTL.USER_PROFILE,
		);
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

	/**
	 * 구독 상태 wrap - 캐시에 없으면 factory 실행 후 캐싱
	 */
	async wrapSubscription(
		userId: string,
		factory: () => Promise<CachedSubscription | undefined>,
	): Promise<CachedSubscription | undefined> {
		return this.wrap(
			CacheKeys.subscription(userId),
			factory,
			CacheKeys.TTL.SUBSCRIPTION,
		);
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

	/**
	 * 상호 친구 관계 wrap - 캐시에 없으면 factory 실행 후 캐싱
	 */
	async wrapMutualFriend(
		userId: string,
		targetUserId: string,
		factory: () => Promise<boolean>,
	): Promise<boolean> {
		return this.wrap(
			CacheKeys.mutualFriend(userId, targetUserId),
			factory,
			CacheKeys.TTL.MUTUAL_FRIEND,
		);
	}

	// === Todo Category Methods ===

	async getTodoCategories(
		userId: string,
	): Promise<TodoCategoryWithCount[] | undefined> {
		return this.get<TodoCategoryWithCount[]>(CacheKeys.todoCategories(userId));
	}

	async setTodoCategories(
		userId: string,
		categories: TodoCategoryWithCount[],
	): Promise<void> {
		return this.set(
			CacheKeys.todoCategories(userId),
			categories,
			CacheKeys.TTL.TODO_CATEGORIES,
		);
	}

	async invalidateTodoCategories(userId: string): Promise<void> {
		return this.del(CacheKeys.todoCategories(userId));
	}

	async wrapTodoCategories(
		userId: string,
		factory: () => Promise<TodoCategoryWithCount[]>,
	): Promise<TodoCategoryWithCount[]> {
		return this.wrap(
			CacheKeys.todoCategories(userId),
			factory,
			CacheKeys.TTL.TODO_CATEGORIES,
		);
	}

	// === Mutual Friend IDs Methods ===

	async getMutualFriendIdsList(userId: string): Promise<string[] | undefined> {
		return this.get<string[]>(CacheKeys.mutualFriendIds(userId));
	}

	async setMutualFriendIdsList(userId: string, ids: string[]): Promise<void> {
		return this.set(
			CacheKeys.mutualFriendIds(userId),
			ids,
			CacheKeys.TTL.MUTUAL_FRIEND_IDS,
		);
	}

	async invalidateMutualFriendIds(userId: string): Promise<void> {
		return this.del(CacheKeys.mutualFriendIds(userId));
	}

	async wrapMutualFriendIds(
		userId: string,
		factory: () => Promise<string[]>,
	): Promise<string[]> {
		return this.wrap(
			CacheKeys.mutualFriendIds(userId),
			factory,
			CacheKeys.TTL.MUTUAL_FRIEND_IDS,
		);
	}

	// === Push Token Methods ===

	async getPushTokens(userId: string): Promise<string[] | undefined> {
		return this.get<string[]>(CacheKeys.pushTokens(userId));
	}

	async setPushTokens(userId: string, tokens: string[]): Promise<void> {
		return this.set(
			CacheKeys.pushTokens(userId),
			tokens,
			CacheKeys.TTL.PUSH_TOKENS,
		);
	}

	async invalidatePushTokens(userId: string): Promise<void> {
		return this.del(CacheKeys.pushTokens(userId));
	}

	async wrapPushTokens(
		userId: string,
		factory: () => Promise<string[]>,
	): Promise<string[]> {
		return this.wrap(
			CacheKeys.pushTokens(userId),
			factory,
			CacheKeys.TTL.PUSH_TOKENS,
		);
	}

	// === User Preference Methods ===

	async getUserPreference(
		userId: string,
	): Promise<CachedUserPreference | undefined> {
		return this.get<CachedUserPreference>(CacheKeys.userPreference(userId));
	}

	async setUserPreference(
		userId: string,
		preference: CachedUserPreference,
	): Promise<void> {
		return this.set(
			CacheKeys.userPreference(userId),
			preference,
			CacheKeys.TTL.USER_PREFERENCE,
		);
	}

	async invalidateUserPreference(userId: string): Promise<void> {
		return this.del(CacheKeys.userPreference(userId));
	}

	async wrapUserPreference(
		userId: string,
		factory: () => Promise<CachedUserPreference>,
	): Promise<CachedUserPreference> {
		return this.wrap(
			CacheKeys.userPreference(userId),
			factory,
			CacheKeys.TTL.USER_PREFERENCE,
		);
	}

	// === Friend Count Methods ===

	async getFriendCount(userId: string): Promise<number | undefined> {
		return this.get<number>(CacheKeys.friendCount(userId));
	}

	async setFriendCount(userId: string, count: number): Promise<void> {
		return this.set(
			CacheKeys.friendCount(userId),
			count,
			CacheKeys.TTL.FRIEND_COUNT,
		);
	}

	async invalidateFriendCount(userId: string): Promise<void> {
		return this.del(CacheKeys.friendCount(userId));
	}

	async wrapFriendCount(
		userId: string,
		factory: () => Promise<number>,
	): Promise<number> {
		return this.wrap(
			CacheKeys.friendCount(userId),
			factory,
			CacheKeys.TTL.FRIEND_COUNT,
		);
	}

	// === Active Timezones Methods ===

	async wrapActiveTimezones(
		factory: () => Promise<string[]>,
	): Promise<string[]> {
		return this.wrap(
			CacheKeys.activeTimezones(),
			factory,
			CacheKeys.TTL.ACTIVE_TIMEZONES,
		);
	}

	async invalidateActiveTimezones(): Promise<void> {
		return this.del(CacheKeys.activeTimezones());
	}

	// === Unread Count Methods ===

	async invalidateUnreadCount(userId: string): Promise<void> {
		return this.del(CacheKeys.unreadCount(userId));
	}

	async wrapUnreadCount(
		userId: string,
		factory: () => Promise<number>,
	): Promise<number> {
		return this.wrap(
			CacheKeys.unreadCount(userId),
			factory,
			CacheKeys.TTL.UNREAD_COUNT,
		);
	}
}

import type { CachedUserProfile } from "../cache.service";
import {
	type CacheStats,
	type ICacheService,
	parseTtl,
	type TtlValue,
} from "../interfaces/cache.interface";

/**
 * 테스트용 Mock 캐시 어댑터
 */
export class MockCacheAdapter implements ICacheService {
	private store = new Map<string, { value: unknown; expiresAt: number }>();
	public stats = { hits: 0, misses: 0 };
	private defaultTtlMs = 60 * 60 * 1000; // 1시간

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.store.get(key);
		if (!entry) {
			this.stats.misses++;
			return undefined;
		}
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			this.stats.misses++;
			return undefined;
		}
		this.stats.hits++;
		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
		const ttlMs = ttl ? parseTtl(ttl) : this.defaultTtlMs;
		this.store.set(key, {
			value,
			expiresAt: Date.now() + ttlMs,
		});
	}

	async del(key: string): Promise<void> {
		this.store.delete(key);
	}

	async delByPattern(pattern: string): Promise<number> {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
		let count = 0;
		for (const key of this.store.keys()) {
			if (regex.test(key)) {
				this.store.delete(key);
				count++;
			}
		}
		return count;
	}

	async reset(): Promise<void> {
		this.store.clear();
		this.stats = { hits: 0, misses: 0 };
	}

	getStats(): CacheStats {
		return { ...this.stats, keys: this.store.size };
	}

	async wrap<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: TtlValue,
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== undefined) {
			return cached;
		}
		const value = await factory();
		if (value !== undefined && value !== null) {
			await this.set(key, value, ttl);
		}
		return value;
	}

	async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
		return Promise.all(keys.map((key) => this.get<T>(key)));
	}

	async mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void> {
		await Promise.all(
			entries.map(({ key, value, ttl }) => this.set(key, value, ttl)),
		);
	}

	async has(key: string): Promise<boolean> {
		const entry = this.store.get(key);
		if (!entry) return false;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return false;
		}
		return true;
	}

	async ttl(key: string): Promise<number> {
		const entry = this.store.get(key);
		if (!entry) return -2;
		const remaining = entry.expiresAt - Date.now();
		if (remaining <= 0) {
			this.store.delete(key);
			return -2;
		}
		return remaining;
	}

	async touch(key: string, ttl: TtlValue): Promise<boolean> {
		const entry = this.store.get(key);
		if (!entry) return false;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return false;
		}
		entry.expiresAt = Date.now() + parseTtl(ttl);
		return true;
	}

	// 테스트 헬퍼 메서드
	getStoreSize(): number {
		return this.store.size;
	}

	hasKey(key: string): boolean {
		return this.store.has(key);
	}

	getAllKeys(): string[] {
		return Array.from(this.store.keys());
	}
}

/**
 * 캐시 테스트 헬퍼: Jest Mock 생성
 */
export function createMockCacheService(): jest.Mocked<ICacheService> {
	return {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		delByPattern: jest.fn(),
		reset: jest.fn(),
		getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, keys: 0 }),
		wrap: jest.fn(),
		mget: jest.fn(),
		mset: jest.fn(),
		has: jest.fn(),
		ttl: jest.fn(),
		touch: jest.fn(),
	};
}

/**
 * 캐시 테스트 헬퍼: 지연 시뮬레이션
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 캐시 테스트 헬퍼: 여러 캐시 항목 설정
 */
export async function setMultipleCacheEntries(
	cache: ICacheService,
	entries: Array<{ key: string; value: unknown; ttl?: TtlValue }>,
): Promise<void> {
	await Promise.all(
		entries.map((entry) => cache.set(entry.key, entry.value, entry.ttl)),
	);
}

/**
 * 캐시 테스트 헬퍼: 캐시 히트율 계산
 */
export function calculateHitRate(stats: CacheStats): number {
	const total = stats.hits + stats.misses;
	if (total === 0) return 0;
	return (stats.hits / total) * 100;
}

/**
 * 캐시 테스트 헬퍼: 완전한 CachedUserProfile mock 데이터 생성
 */
export function createMockUserProfile(
	overrides: Partial<CachedUserProfile> = {},
): CachedUserProfile {
	return {
		id: "user-123",
		email: "test@example.com",
		userTag: "ABC123",
		status: "ACTIVE",
		emailVerifiedAt: new Date().toISOString(),
		subscriptionStatus: "FREE",
		subscriptionExpiresAt: null,
		name: "Test User",
		profileImage: null,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

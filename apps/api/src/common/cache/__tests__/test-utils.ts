import { CacheStats, ICacheService } from "../interfaces/cache.interface";

/**
 * 테스트용 Mock 캐시 어댑터
 */
export class MockCacheAdapter implements ICacheService {
	private store = new Map<string, unknown>();
	public stats = { hits: 0, misses: 0 };

	async get<T>(key: string): Promise<T | undefined> {
		const value = this.store.get(key);
		if (value !== undefined) {
			this.stats.hits++;
			return value as T;
		}
		this.stats.misses++;
		return undefined;
	}

	async set<T>(key: string, value: T): Promise<void> {
		this.store.set(key, value);
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
	entries: Array<{ key: string; value: unknown; ttlMs?: number }>,
): Promise<void> {
	await Promise.all(
		entries.map((entry) => cache.set(entry.key, entry.value, entry.ttlMs)),
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

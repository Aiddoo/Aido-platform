/**
 * 캐시 서비스 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 전환 가능
 */

export const CACHE_SERVICE = Symbol("CACHE_SERVICE");

export interface ICacheService {
	/**
	 * 캐시에서 값 조회
	 * @returns 캐시 미스 시 undefined
	 */
	get<T>(key: string): Promise<T | undefined>;

	/**
	 * 캐시에 값 저장
	 * @param ttlMs TTL (밀리초), undefined면 기본값 사용
	 */
	set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

	/**
	 * 캐시에서 값 삭제
	 */
	del(key: string): Promise<void>;

	/**
	 * 패턴에 매칭되는 모든 키 삭제
	 * @param pattern 와일드카드 패턴 (예: "user:*")
	 */
	delByPattern(pattern: string): Promise<number>;

	/**
	 * 캐시 전체 초기화
	 */
	reset(): Promise<void>;

	/**
	 * 캐시 통계 조회 (모니터링용)
	 */
	getStats(): CacheStats;
}

export interface CacheStats {
	hits: number;
	misses: number;
	keys: number;
	memoryUsage?: number; // bytes (인메모리 전용)
}

export interface CacheConfig {
	type: "memory" | "redis";
	defaultTtlMs: number;
	maxItems: number;
	redis?: RedisConfig;
}

export interface RedisConfig {
	host: string;
	port: number;
	password?: string;
	db?: number;
}

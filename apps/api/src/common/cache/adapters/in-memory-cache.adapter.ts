import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import {
	type CacheStats,
	type ICacheService,
	parseTtl,
	type TtlValue,
} from "../interfaces/cache.interface";

interface CacheEntry<T> {
	value: T;
	expiresAt: number; // timestamp
}

/**
 * 인메모리 캐시 어댑터
 *
 * - Map 기반 저장소
 * - TTL 지원 (숫자 밀리초 + shorthand 문자열)
 * - FIFO 방식 Eviction (maxItems 초과 시)
 * - 30초마다 만료된 항목 자동 정리
 * - wrap, mget, mset, has, ttl, touch 메서드 지원
 */
@Injectable()
export class InMemoryCacheAdapter implements ICacheService, OnModuleDestroy {
	private readonly logger = new Logger(InMemoryCacheAdapter.name);
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly defaultTtlMs: number;
	private readonly maxItems: number;

	private stats = { hits: 0, misses: 0 };
	private cleanupInterval: NodeJS.Timeout;

	constructor(config: {
		defaultTtlMs: number;
		maxItems: number;
		cleanupIntervalMs?: number;
	}) {
		this.defaultTtlMs = config.defaultTtlMs;
		this.maxItems = config.maxItems;

		// cleanupInterval을 설정 가능하게 (기본값 30초)
		const cleanupInterval = config.cleanupIntervalMs ?? 30_000;

		// validation 추가: 최소 1초
		if (cleanupInterval < 1000) {
			throw new Error(
				`cleanupIntervalMs must be at least 1000ms (1 second), got ${cleanupInterval}ms`,
			);
		}

		this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);
	}

	onModuleDestroy() {
		clearInterval(this.cleanupInterval);
	}

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.cache.get(key) as CacheEntry<T> | undefined;

		if (!entry) {
			this.stats.misses++;
			this.logger.debug(`MISS ${key}`);
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.stats.misses++;
			this.logger.debug(`EXPIRED ${key}`);
			return undefined;
		}

		this.stats.hits++;
		this.logger.debug(`HIT ${key}`);
		return entry.value;
	}

	async set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
		// TTL이 0이면 즉시 만료 (저장하지 않음)
		if (ttl === 0) {
			this.logger.debug(`SET ${key} skipped (TTL: 0, immediate expiration)`);
			return;
		}

		// FIFO: 최대 항목 수 초과 시 가장 먼저 삽입된 항목 삭제
		if (this.cache.size >= this.maxItems) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
				this.logger.debug(`EVICTED ${oldestKey} (max items reached)`);
			}
		}

		const ttlMs = ttl !== undefined ? parseTtl(ttl) : this.defaultTtlMs;
		const expiresAt = Date.now() + ttlMs;
		this.cache.set(key, { value, expiresAt });
		this.logger.debug(`SET ${key} (TTL: ${ttlMs}ms)`);
	}

	async del(key: string): Promise<void> {
		const deleted = this.cache.delete(key);
		if (deleted) {
			this.logger.debug(`DEL ${key}`);
		}
	}

	async delByPattern(pattern: string): Promise<number> {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
		let count = 0;

		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
				count++;
			}
		}

		this.logger.debug(`DEL_PATTERN ${pattern} (${count} keys)`);
		return count;
	}

	async reset(): Promise<void> {
		const size = this.cache.size;
		this.cache.clear();
		this.stats = { hits: 0, misses: 0 };
		this.logger.debug(`RESET (${size} keys cleared)`);
	}

	getStats(): CacheStats {
		return {
			...this.stats,
			keys: this.cache.size,
			memoryUsage: this.estimateMemoryUsage(),
		};
	}

	// === 새로운 메서드 (Cacheable 패턴) ===

	async wrap<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: TtlValue,
	): Promise<T> {
		// 1. 캐시 조회
		const cached = await this.get<T>(key);
		if (cached !== undefined) {
			return cached;
		}

		// 2. Factory 실행
		const value = await factory();

		// 3. undefined/null이 아니면 캐싱
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
		const entry = this.cache.get(key);
		if (!entry) return false;

		// 만료 체크
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	async ttl(key: string): Promise<number> {
		const entry = this.cache.get(key);

		// 키가 없으면 -2 (Redis PTTL 규칙)
		if (!entry) return -2;

		const remaining = entry.expiresAt - Date.now();

		// 이미 만료되었으면 삭제하고 -2
		if (remaining <= 0) {
			this.cache.delete(key);
			return -2;
		}

		return remaining;
	}

	async touch(key: string, ttl: TtlValue): Promise<boolean> {
		const entry = this.cache.get(key);

		// 키가 없으면 false
		if (!entry) return false;

		// 만료 체크
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return false;
		}

		// TTL 갱신
		const ttlMs = parseTtl(ttl);
		entry.expiresAt = Date.now() + ttlMs;
		this.logger.debug(`TOUCH ${key} (TTL: ${ttlMs}ms)`);

		return true;
	}

	// === Private 헬퍼 ===

	private cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.logger.debug(`CLEANUP ${cleaned} expired entries`);
		}
	}

	private estimateMemoryUsage(): number {
		// 대략적인 메모리 사용량 추정 (정확하지 않음)
		let size = 0;
		for (const [key, entry] of this.cache.entries()) {
			size += key.length * 2; // UTF-16
			size += JSON.stringify(entry.value).length * 2;
			size += 8; // expiresAt (number)
		}
		return size;
	}
}

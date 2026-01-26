import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { CacheStats, ICacheService } from "../interfaces/cache.interface";

interface CacheEntry<T> {
	value: T;
	expiresAt: number; // timestamp
}

/**
 * 인메모리 캐시 어댑터
 *
 * - Map 기반 저장소
 * - TTL 지원
 * - FIFO 방식 Eviction (maxItems 초과 시)
 * - 30초마다 만료된 항목 자동 정리
 */
@Injectable()
export class InMemoryCacheAdapter implements ICacheService, OnModuleDestroy {
	private readonly logger = new Logger(InMemoryCacheAdapter.name);
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly defaultTtlMs: number;
	private readonly maxItems: number;

	private stats = { hits: 0, misses: 0 };
	private cleanupInterval: NodeJS.Timeout;

	constructor(config: { defaultTtlMs: number; maxItems: number }) {
		this.defaultTtlMs = config.defaultTtlMs;
		this.maxItems = config.maxItems;

		// 30초마다 만료된 항목 정리
		this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
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

	async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
		// FIFO: 최대 항목 수 초과 시 가장 먼저 삽입된 항목 삭제
		if (this.cache.size >= this.maxItems) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
				this.logger.debug(`EVICTED ${oldestKey} (max items reached)`);
			}
		}

		const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
		this.cache.set(key, { value, expiresAt });
		this.logger.debug(`SET ${key} (TTL: ${ttlMs ?? this.defaultTtlMs}ms)`);
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

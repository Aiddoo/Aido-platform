import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type {
	CacheStats,
	ICacheService,
	TtlValue,
} from "../interfaces/cache.interface";
import { parseTtl } from "../interfaces/cache.interface";

/**
 * Redis 캐시 어댑터
 *
 * 공유 ioredis 인스턴스를 사용하여 Redis 캐시를 구현합니다.
 * RedisModule이 제공하는 REDIS_CLIENT를 주입받아 사용합니다.
 *
 * Redis 명령어 매핑:
 * - get()         → GET + JSON.parse
 * - set()         → SET + PX (밀리초 TTL)
 * - del()         → DEL
 * - delByPattern() → SCAN + DEL (cursor 기반)
 * - reset()       → SCAN + DEL (cache: prefix 기반)
 * - getStats()    → 내부 카운터 (keys는 -1 반환)
 * - wrap()        → GET → miss면 factory() → SET
 * - mget()        → MGET + JSON.parse
 * - mset()        → Pipeline SET
 * - has()         → EXISTS
 * - ttl()         → PTTL (밀리초 단위)
 * - touch()       → PEXPIRE
 */
@Injectable()
export class RedisCacheAdapter implements ICacheService {
	readonly #logger = new Logger(RedisCacheAdapter.name);
	readonly #redis: Redis;
	readonly #defaultTtlMs: number;
	readonly #keyPrefix = "cache:";
	readonly #inflight = new Map<string, Promise<unknown>>();
	#stats = { hits: 0, misses: 0 };

	constructor(redis: Redis, defaultTtlMs: number) {
		this.#redis = redis;
		this.#defaultTtlMs = defaultTtlMs;
		this.#logger.log("RedisCacheAdapter initialized");
	}

	async get<T>(key: string): Promise<T | undefined> {
		const data = await this.#redis.get(this.#keyPrefix + key);

		if (data === null) {
			this.#stats.misses++;
			return undefined;
		}

		this.#stats.hits++;
		return JSON.parse(data) as T;
	}

	async set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
		const ttlMs = ttl ? parseTtl(ttl) : this.#defaultTtlMs;
		await this.#redis.set(
			this.#keyPrefix + key,
			JSON.stringify(value),
			"PX",
			ttlMs,
		);
	}

	async del(key: string): Promise<void> {
		await this.#redis.del(this.#keyPrefix + key);
	}

	async delByPattern(pattern: string): Promise<number> {
		const fullPattern = this.#keyPrefix + pattern;
		let cursor = "0";
		let count = 0;

		do {
			const [nextCursor, keys] = await this.#redis.scan(
				cursor,
				"MATCH",
				fullPattern,
				"COUNT",
				100,
			);
			cursor = nextCursor;

			if (keys.length > 0) {
				await this.#redis.del(...keys);
				count += keys.length;
			}
		} while (cursor !== "0");

		this.#logger.debug(`DEL_PATTERN ${pattern} (${count} keys)`);
		return count;
	}

	async reset(): Promise<void> {
		const fullPattern = `${this.#keyPrefix}*`;
		let cursor = "0";

		do {
			const [nextCursor, keys] = await this.#redis.scan(
				cursor,
				"MATCH",
				fullPattern,
				"COUNT",
				100,
			);
			cursor = nextCursor;

			if (keys.length > 0) {
				await this.#redis.del(...keys);
			}
		} while (cursor !== "0");

		this.#stats = { hits: 0, misses: 0 };
		this.#logger.debug("RESET completed");
	}

	getStats(): CacheStats {
		return {
			...this.#stats,
			keys: -1,
		};
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

		// Singleflight: 동일 key에 대한 동시 요청은 하나의 factory만 실행.
		// Note: get()과 inflight 체크 사이에 레이스가 존재할 수 있으나,
		// factory는 멱등이므로 중복 실행은 성능 낭비일 뿐 정합성 문제 없음.
		// factory 에러 시 대기 중인 모든 요청에 동일 에러 전파 (의도된 동작).
		const fullKey = this.#keyPrefix + key;
		const existing = this.#inflight.get(fullKey);
		if (existing) {
			return existing as Promise<T>;
		}

		const promise = factory()
			.then(async (value) => {
				if (value !== undefined && value !== null) {
					await this.set(key, value, ttl);
				}
				return value;
			})
			.finally(() => {
				this.#inflight.delete(fullKey);
			});

		this.#inflight.set(fullKey, promise);
		return promise;
	}

	async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
		if (keys.length === 0) return [];

		const prefixedKeys = keys.map((k) => this.#keyPrefix + k);
		const values = await this.#redis.mget(...prefixedKeys);

		return values.map((data) => {
			if (data === null) {
				this.#stats.misses++;
				return undefined;
			}
			this.#stats.hits++;
			return JSON.parse(data) as T;
		});
	}

	async mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void> {
		if (entries.length === 0) return;

		const pipeline = this.#redis.pipeline();
		for (const { key, value, ttl } of entries) {
			const ttlMs = ttl ? parseTtl(ttl) : this.#defaultTtlMs;
			pipeline.set(this.#keyPrefix + key, JSON.stringify(value), "PX", ttlMs);
		}
		await pipeline.exec();
	}

	async has(key: string): Promise<boolean> {
		const exists = await this.#redis.exists(this.#keyPrefix + key);
		return exists === 1;
	}

	async ttl(key: string): Promise<number> {
		return this.#redis.pttl(this.#keyPrefix + key);
	}

	async touch(key: string, ttl: TtlValue): Promise<boolean> {
		const ttlMs = parseTtl(ttl);
		const result = await this.#redis.pexpire(this.#keyPrefix + key, ttlMs);
		return result === 1;
	}
}

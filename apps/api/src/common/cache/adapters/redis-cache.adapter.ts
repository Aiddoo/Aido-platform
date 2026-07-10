import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler";
import type {
	CacheStats,
	ICacheService,
	TtlValue,
} from "../interfaces/cache.interface";
import { parseTtl } from "../interfaces/cache.interface";

/**
 * Redis 캐시 어댑터
 *
 * RedisModule이 제공하는 REDIS_COMMAND_CLIENT(fail-fast 연결)를 주입받아
 * 사용합니다.
 *
 * 장애 정책 — fail-open (ICacheService 계약):
 * - 읽기(get/mget/has/ttl/touch)는 실패 시 캐시 미스로 취급 → 소비처가
 *   원본(DB)으로 폴백한다
 * - 쓰기(set/mset/del/reset)는 실패 시 조용히 무시 — TTL이 staleness
 *   상한이므로 복구 후 자연 소멸한다
 * - 에러 로그는 RedisErrorLogSampler로 윈도우당 1회만 남긴다
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
	readonly #errorSampler: RedisErrorLogSampler;
	#stats = { hits: 0, misses: 0 };

	constructor(
		redis: Redis,
		defaultTtlMs: number,
		errorSampler?: RedisErrorLogSampler,
	) {
		this.#redis = redis;
		this.#defaultTtlMs = defaultTtlMs;
		this.#errorSampler = errorSampler ?? new RedisErrorLogSampler(this.#logger);
		this.#logger.log("RedisCacheAdapter initialized");
	}

	async get<T>(key: string): Promise<T | undefined> {
		return this.#failOpen(
			"GET",
			async () => {
				const data = await this.#redis.get(this.#keyPrefix + key);

				if (data === null) {
					this.#stats.misses++;
					return undefined;
				}

				this.#stats.hits++;
				return JSON.parse(data) as T;
			},
			undefined,
		);
	}

	async set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
		await this.#failOpen(
			"SET",
			async () => {
				const ttlMs = ttl ? parseTtl(ttl) : this.#defaultTtlMs;
				await this.#redis.set(
					this.#keyPrefix + key,
					JSON.stringify(value),
					"PX",
					ttlMs,
				);
			},
			undefined,
		);
	}

	async del(key: string): Promise<void> {
		await this.#failOpen(
			"DEL",
			async () => {
				await this.#redis.del(this.#keyPrefix + key);
			},
			undefined,
		);
	}

	async delByPattern(pattern: string): Promise<number> {
		const fullPattern = this.#keyPrefix + pattern;
		let cursor = "0";
		let count = 0;

		try {
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
		} catch (error) {
			// fail-open: 지금까지 삭제한 개수만 반환 — 남은 키는 TTL로 소멸
			this.#errorSampler.warn("DEL_PATTERN", error);
			return count;
		}

		this.#logger.debug(`DEL_PATTERN ${pattern} (${count} keys)`);
		return count;
	}

	async reset(): Promise<void> {
		await this.#failOpen(
			"RESET",
			async () => {
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
			},
			undefined,
		);
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
		// get/set이 fail-open이므로 Redis 장애 시 자동으로 factory 직행 (DB 폴백)
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

		return this.#failOpen(
			"MGET",
			async () => {
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
			},
			keys.map(() => undefined),
		);
	}

	async mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void> {
		if (entries.length === 0) return;

		await this.#failOpen(
			"MSET",
			async () => {
				const pipeline = this.#redis.pipeline();
				for (const { key, value, ttl } of entries) {
					const ttlMs = ttl ? parseTtl(ttl) : this.#defaultTtlMs;
					pipeline.set(
						this.#keyPrefix + key,
						JSON.stringify(value),
						"PX",
						ttlMs,
					);
				}
				await pipeline.exec();
			},
			undefined,
		);
	}

	async has(key: string): Promise<boolean> {
		return this.#failOpen(
			"EXISTS",
			async () => {
				const exists = await this.#redis.exists(this.#keyPrefix + key);
				return exists === 1;
			},
			false,
		);
	}

	async ttl(key: string): Promise<number> {
		// fail-open 시 -2 = "키 없음" 시맨틱
		return this.#failOpen(
			"PTTL",
			() => this.#redis.pttl(this.#keyPrefix + key),
			-2,
		);
	}

	async touch(key: string, ttl: TtlValue): Promise<boolean> {
		return this.#failOpen(
			"PEXPIRE",
			async () => {
				const ttlMs = parseTtl(ttl);
				const result = await this.#redis.pexpire(this.#keyPrefix + key, ttlMs);
				return result === 1;
			},
			false,
		);
	}

	/**
	 * fail-open 래퍼: Redis 장애 시 fallback을 반환하고 샘플드 warn만 남긴다
	 */
	async #failOpen<T>(
		operation: string,
		action: () => Promise<T>,
		fallback: T,
	): Promise<T> {
		try {
			return await action();
		} catch (error) {
			this.#errorSampler.warn(operation, error);
			return fallback;
		}
	}
}

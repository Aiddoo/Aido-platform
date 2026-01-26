import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type {
	CacheConfig,
	CacheStats,
	ICacheService,
	TtlValue,
} from "../interfaces/cache.interface";
import { parseTtl } from "../interfaces/cache.interface";

/**
 * Redis 캐시 어댑터 (스텁)
 *
 * 나중에 Redis로 전환 시 ioredis 패키지 설치 후 구현
 * 현재는 환경변수 CACHE_TYPE=redis로 설정 시에만 사용됨
 *
 * 전환 방법:
 * 1. pnpm add ioredis
 * 2. 아래 주석 해제 및 TODO 부분 구현
 * 3. CACHE_TYPE=redis로 환경변수 변경
 *
 * Redis 명령어 매핑:
 * - get()       → GET + JSON.parse
 * - set()       → SET + PX (밀리초 TTL)
 * - del()       → DEL
 * - delByPattern() → SCAN + DEL (cursor 기반)
 * - reset()     → FLUSHDB
 * - getStats()  → DBSIZE
 * - wrap()      → GET + SET (cache-aside 패턴)
 * - mget()      → MGET
 * - mset()      → Pipeline SET
 * - has()       → EXISTS
 * - ttl()       → PTTL (밀리초 단위)
 * - touch()     → PEXPIRE
 */

// import Redis from 'ioredis';

@Injectable()
export class RedisCacheAdapter implements ICacheService, OnModuleDestroy {
	private readonly logger = new Logger(RedisCacheAdapter.name);
	// private readonly client: Redis;
	private readonly defaultTtlMs: number;
	private stats = { hits: 0, misses: 0 };

	constructor(config: CacheConfig) {
		this.defaultTtlMs = config.defaultTtlMs;

		if (!config.redis) {
			throw new Error("Redis configuration is required for RedisCacheAdapter");
		}

		// TODO: Redis 전환 시 주석 해제
		// this.client = new Redis({
		//   host: config.redis.host,
		//   port: config.redis.port,
		//   password: config.redis.password,
		//   db: config.redis.db ?? 0,
		//   keyPrefix: config.redis.keyPrefix,
		//   connectTimeout: config.redis.connectTimeout ?? 10000,
		//   commandTimeout: config.redis.commandTimeout ?? 5000,
		//   retryStrategy: (times) => Math.min(times * 50, 2000),
		// });
		//
		// this.client.on('error', (err) => this.logger.error('Redis error:', err));
		// this.client.on('connect', () => this.logger.log('Redis connected'));

		this.logger.warn(
			"RedisCacheAdapter is a stub. Install ioredis and implement for production use.",
		);
	}

	async onModuleDestroy() {
		// await this.client.quit();
	}

	async get<T>(_key: string): Promise<T | undefined> {
		// TODO: Redis 전환 시 구현
		// const data = await this.client.get(key);
		//
		// if (!data) {
		//   this.stats.misses++;
		//   this.logger.debug(`MISS ${key}`);
		//   return undefined;
		// }
		//
		// this.stats.hits++;
		// this.logger.debug(`HIT ${key}`);
		// return JSON.parse(data) as T;

		this.stats.misses++;
		this.logger.debug("MISS (Redis stub)");
		return undefined;
	}

	async set<T>(_key: string, _value: T, ttl?: TtlValue): Promise<void> {
		const ttlMs = ttl ? parseTtl(ttl) : this.defaultTtlMs;

		// TODO: Redis 전환 시 구현
		// await this.client.set(key, JSON.stringify(value), 'PX', ttlMs);

		this.logger.debug(`SET (TTL: ${ttlMs}ms) (Redis stub)`);
	}

	async del(_key: string): Promise<void> {
		// TODO: Redis 전환 시 구현
		// await this.client.del(key);

		this.logger.debug("DEL (Redis stub)");
	}

	async delByPattern(_pattern: string): Promise<number> {
		// TODO: Redis 전환 시 구현 - SCAN으로 패턴 매칭 키 조회 후 삭제
		// let cursor = '0';
		// let count = 0;
		//
		// do {
		//   const [nextCursor, keys] = await this.client.scan(
		//     cursor,
		//     'MATCH',
		//     pattern,
		//     'COUNT',
		//     100,
		//   );
		//   cursor = nextCursor;
		//
		//   if (keys.length > 0) {
		//     await this.client.del(...keys);
		//     count += keys.length;
		//   }
		// } while (cursor !== '0');
		//
		// this.logger.debug(`DEL_PATTERN ${pattern} (${count} keys)`);
		// return count;

		this.logger.debug("DEL_PATTERN (Redis stub)");
		return 0;
	}

	async reset(): Promise<void> {
		// TODO: Redis 전환 시 구현
		// await this.client.flushdb();

		this.stats = { hits: 0, misses: 0 };
		this.logger.debug("RESET (Redis stub)");
	}

	getStats(): CacheStats {
		// TODO: Redis 전환 시 DBSIZE로 키 수 조회
		// const keys = await this.client.dbsize();
		// return { ...this.stats, keys };

		return {
			...this.stats,
			keys: -1,
		};
	}

	/**
	 * Cache-aside 패턴 구현 (wrap)
	 *
	 * 캐시에 데이터가 있으면 반환, 없으면 factory 실행 후 캐싱
	 *
	 * @param key - 캐시 키
	 * @param factory - 캐시 미스 시 실행할 팩토리 함수
	 * @param ttl - TTL (선택적, 기본값 사용)
	 * @returns 캐시된 값 또는 factory 결과
	 */
	async wrap<T>(
		_key: string,
		factory: () => Promise<T>,
		_ttl?: TtlValue,
	): Promise<T> {
		// TODO: Redis 전환 시 구현
		// const cached = await this.get<T>(_key);
		// if (cached !== undefined) {
		//   return cached;
		// }
		//
		// const value = await factory();
		// if (value !== undefined && value !== null) {
		//   await this.set(_key, value, _ttl);
		// }
		// return value;

		this.logger.debug("WRAP called (Redis stub - calling factory directly)");
		return factory();
	}

	/**
	 * 다중 키 조회 (MGET)
	 *
	 * @param keys - 조회할 키 배열
	 * @returns 각 키에 대한 값 배열 (없으면 undefined)
	 */
	async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
		// TODO: Redis 전환 시 구현
		// if (keys.length === 0) return [];
		//
		// const values = await this.client.mget(...keys);
		// return values.map((data, index) => {
		//   if (!data) {
		//     this.stats.misses++;
		//     return undefined;
		//   }
		//   this.stats.hits++;
		//   return JSON.parse(data) as T;
		// });

		this.logger.debug(`MGET [${keys.length} keys] (Redis stub)`);
		this.stats.misses += keys.length;
		return keys.map(() => undefined);
	}

	/**
	 * 다중 키 저장 (Pipeline SET)
	 *
	 * Redis Pipeline을 사용하여 여러 SET 명령을 한 번에 실행
	 *
	 * @param entries - 저장할 키-값-TTL 배열
	 */
	async mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void> {
		// TODO: Redis 전환 시 구현
		// if (entries.length === 0) return;
		//
		// const pipeline = this.client.pipeline();
		// for (const { key, value, ttl } of entries) {
		//   const ttlMs = ttl ? parseTtl(ttl) : this.defaultTtlMs;
		//   pipeline.set(key, JSON.stringify(value), 'PX', ttlMs);
		// }
		// await pipeline.exec();

		this.logger.debug(`MSET [${entries.length} entries] (Redis stub)`);
	}

	/**
	 * 키 존재 여부 확인 (EXISTS)
	 *
	 * @param key - 확인할 키
	 * @returns 존재하면 true, 아니면 false
	 */
	async has(key: string): Promise<boolean> {
		// TODO: Redis 전환 시 구현
		// const exists = await this.client.exists(key);
		// return exists === 1;

		this.logger.debug(`HAS ${key} (Redis stub - always false)`);
		return false;
	}

	/**
	 * 키의 남은 TTL 조회 (PTTL)
	 *
	 * @param key - 조회할 키
	 * @returns 남은 밀리초, -1 (TTL 없음), -2 (키 없음)
	 */
	async ttl(key: string): Promise<number> {
		// TODO: Redis 전환 시 구현
		// const pttl = await this.client.pttl(key);
		// return pttl; // Redis PTTL returns: -2 if key doesn't exist, -1 if no TTL

		this.logger.debug(`TTL ${key} (Redis stub - returning -2)`);
		return -2; // 키 없음
	}

	/**
	 * 키의 TTL 갱신 (PEXPIRE)
	 *
	 * @param key - 갱신할 키
	 * @param ttl - 새 TTL 값
	 * @returns 성공 시 true, 키가 없으면 false
	 */
	async touch(key: string, ttl: TtlValue): Promise<boolean> {
		const ttlMs = parseTtl(ttl);

		// TODO: Redis 전환 시 구현
		// const result = await this.client.pexpire(key, ttlMs);
		// return result === 1;

		this.logger.debug(`TOUCH ${key} (TTL: ${ttlMs}ms) (Redis stub - false)`);
		return false;
	}
}

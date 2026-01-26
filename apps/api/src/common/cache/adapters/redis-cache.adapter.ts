import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type {
	CacheConfig,
	CacheStats,
	ICacheService,
} from "../interfaces/cache.interface";

/**
 * Redis 캐시 어댑터 (스텁)
 *
 * 나중에 Redis로 전환 시 ioredis 패키지 설치 후 구현
 * 현재는 환경변수 CACHE_TYPE=redis로 설정 시에만 사용됨
 *
 * 전환 방법:
 * 1. pnpm add ioredis @types/ioredis
 * 2. 아래 주석 해제
 * 3. CACHE_TYPE=redis로 환경변수 변경
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
		// });

		this.logger.warn(
			"RedisCacheAdapter is a stub. Install ioredis and implement for production use.",
		);
	}

	async onModuleDestroy() {
		// await this.client.quit();
	}

	async get<T>(key: string): Promise<T | undefined> {
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
		this.logger.debug(`MISS ${key} (Redis stub)`);
		return undefined;
	}

	async set<T>(key: string, _value: T, ttlMs?: number): Promise<void> {
		const ttl = ttlMs ?? this.defaultTtlMs;

		// TODO: Redis 전환 시 구현
		// await this.client.set(key, JSON.stringify(value), 'PX', ttl);

		this.logger.debug(`SET ${key} (TTL: ${ttl}ms) (Redis stub)`);
	}

	async del(key: string): Promise<void> {
		// TODO: Redis 전환 시 구현
		// await this.client.del(key);

		this.logger.debug(`DEL ${key} (Redis stub)`);
	}

	async delByPattern(pattern: string): Promise<number> {
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

		this.logger.debug(`DEL_PATTERN ${pattern} (Redis stub)`);
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
		return {
			...this.stats,
			keys: -1,
		};
	}
}

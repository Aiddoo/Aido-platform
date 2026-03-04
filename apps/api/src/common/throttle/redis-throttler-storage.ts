import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import type Redis from "ioredis";

/**
 * Lua 스크립트: atomic throttle increment + block 처리
 *
 * KEYS[1] = hit count key
 * KEYS[2] = block key
 * ARGV[1] = ttl (ms)
 * ARGV[2] = limit
 * ARGV[3] = blockDuration (ms)
 *
 * Returns: [totalHits, timeToExpire, isBlocked(0|1), timeToBlockExpire]
 */
const THROTTLE_INCREMENT_SCRIPT = `
  local hitKey = KEYS[1]
  local blockKey = KEYS[2]
  local ttl = tonumber(ARGV[1])
  local limit = tonumber(ARGV[2])
  local blockDuration = tonumber(ARGV[3])

  -- 현재 차단 상태 확인
  local blockTTL = redis.call("PTTL", blockKey)
  if blockTTL > 0 then
    local totalHits = tonumber(redis.call("GET", hitKey) or "0")
    return {totalHits, 0, 1, blockTTL}
  end

  -- 히트 카운터 증가
  local totalHits = redis.call("INCR", hitKey)
  if totalHits == 1 then
    redis.call("PEXPIRE", hitKey, ttl)
  end

  local pttl = redis.call("PTTL", hitKey)
  if pttl < 0 then
    redis.call("PEXPIRE", hitKey, ttl)
    pttl = ttl
  end

  -- 제한 초과 시 차단 키 설정
  if totalHits > limit and blockDuration > 0 then
    redis.call("SET", blockKey, "1", "PX", blockDuration)
    return {totalHits, pttl, 1, blockDuration}
  end

  return {totalHits, pttl, 0, 0}
`;

/**
 * Redis 기반 ThrottlerStorage
 *
 * - Lua 스크립트로 atomic increment + TTL + block 처리
 * - 멀티 인스턴스 환경에서 rate limit 공유
 * - Redis 장애 시 fail-open (요청 허용)
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
	readonly #logger = new Logger(RedisThrottlerStorage.name);
	readonly #redis: Redis;
	readonly #keyPrefix = "throttle:";

	constructor(redis: Redis) {
		this.#redis = redis;
	}

	async increment(
		key: string,
		ttl: number,
		limit: number,
		blockDuration: number,
		throttlerName: string,
	): Promise<ThrottlerStorageRecord> {
		const hitKey = `${this.#keyPrefix}${throttlerName}:${key}`;
		const blockKey = `${hitKey}:blocked`;

		try {
			const result = (await this.#redis.eval(
				THROTTLE_INCREMENT_SCRIPT,
				2,
				hitKey,
				blockKey,
				ttl,
				limit,
				blockDuration,
			)) as [number, number, number, number];

			return {
				totalHits: result[0],
				timeToExpire: result[1],
				isBlocked: result[2] === 1,
				timeToBlockExpire: result[3],
			};
		} catch (error) {
			this.#logger.warn(
				`Redis throttle error (fail-open): ${error instanceof Error ? error.message : error}`,
			);

			// fail-open: Redis 장애 시 요청 허용
			return {
				totalHits: 0,
				timeToExpire: 0,
				isBlocked: false,
				timeToBlockExpire: 0,
			};
		}
	}
}

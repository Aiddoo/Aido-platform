import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import type Redis from "ioredis";
import { RedisErrorLogSampler } from "../redis/redis-error-log-sampler";

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
 * Lua 스크립트 결과를 검증해 ThrottlerStorageRecord로 변환
 *
 * @throws 예상 형태([number x4])가 아니면 에러 — increment의 catch에서
 *         fail-open으로 흡수된다
 */
function isNumberQuad(raw: unknown): raw is [number, number, number, number] {
	return (
		Array.isArray(raw) &&
		raw.length === 4 &&
		raw.every((value) => typeof value === "number")
	);
}

function parseThrottleResult(raw: unknown): ThrottlerStorageRecord {
	if (!isNumberQuad(raw)) {
		throw new Error(
			`Unexpected throttle script result: ${JSON.stringify(raw)}`,
		);
	}

	const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = raw;

	return {
		totalHits,
		timeToExpire,
		isBlocked: isBlocked === 1,
		timeToBlockExpire,
	};
}

/**
 * Redis 기반 ThrottlerStorage
 *
 * - Lua 스크립트로 atomic increment + TTL + block 처리
 * - 멀티 인스턴스 환경에서 rate limit 공유
 * - Redis 장애 시 fail-open (요청 허용)
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
	readonly #logger = new Logger(RedisThrottlerStorage.name);
	readonly #errorSampler = new RedisErrorLogSampler(this.#logger);
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
			const raw = await this.#redis.eval(
				THROTTLE_INCREMENT_SCRIPT,
				2,
				hitKey,
				blockKey,
				ttl,
				limit,
				blockDuration,
			);

			return parseThrottleResult(raw);
		} catch (error) {
			this.#errorSampler.warn("THROTTLE_INCREMENT", error);

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

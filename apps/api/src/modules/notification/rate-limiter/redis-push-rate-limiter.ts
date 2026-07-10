import { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { RedisErrorLogSampler } from "@/common/redis/redis-error-log-sampler";
import type { IPushRateLimiter } from "./push-rate-limiter.interface";

/** 1시간 윈도우 내 최대 푸시 횟수 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

/**
 * Lua 스크립트: Sorted Set 기반 슬라이딩 윈도우 rate limit
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = 현재 시각 (ms)
 * ARGV[2] = 윈도우 시작 시각 (ms)
 * ARGV[3] = 최대 허용 횟수
 * ARGV[4] = 윈도우 TTL (ms)
 *
 * Returns: 1 = rate limited, 0 = allowed
 */
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local windowStart = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local windowMs = tonumber(ARGV[4])

  -- 윈도우 밖 엔트리 제거
  redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart)

  -- 현재 카운트 확인
  local count = redis.call("ZCARD", key)

  if count >= limit then
    return 1
  end

  -- 새 엔트리 추가 (member를 고유하게 만들기 위해 now + random)
  redis.call("ZADD", key, now, now .. ":" .. math.random(1, 1000000))
  redis.call("PEXPIRE", key, windowMs)

  return 0
`;

/**
 * Redis Sorted Set 기반 푸시 Rate Limiter
 *
 * - 슬라이딩 윈도우 방식 (1시간, 15회)
 * - Lua 스크립트로 atomic 처리
 * - 멀티 인스턴스 환경에서 rate limit 공유
 * - Redis 장애 시 fail-open (발송 허용)
 */
export class RedisPushRateLimiter implements IPushRateLimiter {
	readonly #logger = new Logger(RedisPushRateLimiter.name);
	readonly #redis: Redis;
	readonly #keyPrefix = "push-rate:";
	readonly #errorSampler = new RedisErrorLogSampler(this.#logger);

	constructor(redis: Redis) {
		this.#redis = redis;
	}

	async isRateLimited(userId: string): Promise<boolean> {
		const key = `${this.#keyPrefix}${userId}`;
		const now = Date.now();
		const windowStart = now - RATE_LIMIT_WINDOW_MS;

		try {
			const result = await this.#redis.eval(
				SLIDING_WINDOW_SCRIPT,
				1,
				key,
				now,
				windowStart,
				RATE_LIMIT_MAX,
				RATE_LIMIT_WINDOW_MS,
			);

			return result === 1;
		} catch (error) {
			this.#errorSampler.warn("PUSH_RATE_LIMIT", error);
			// fail-open: Redis 장애 시 발송 허용
			return false;
		}
	}
}

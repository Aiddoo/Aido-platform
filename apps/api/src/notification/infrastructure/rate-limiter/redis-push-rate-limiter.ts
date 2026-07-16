import { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { RedisErrorLogSampler } from "@/shared/infrastructure/redis/redis-error-log-sampler";
import type {
	IPushRateLimiter,
	PushRateLimitRequest,
} from "../../application/ports/push-rate-limiter.port";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/services/push-rate-limit-policy";

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;

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

const ENGAGEMENT_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local minInterval = tonumber(ARGV[2])
  local dailyMax = tonumber(ARGV[3])
  local ttlSeconds = tonumber(ARGV[4])
  local count = tonumber(redis.call("HGET", key, "count") or "0")
  local lastSentAt = tonumber(redis.call("HGET", key, "lastSentAt") or "0")

  if count >= dailyMax or (lastSentAt > 0 and now - lastSentAt < minInterval) then
    return 1
  end

  redis.call("HSET", key, "count", count + 1, "lastSentAt", now)
  redis.call("EXPIRE", key, ttlSeconds)
  return 0
`;

/** 일반 제한과 참여 유도 제한을 입력 순서대로 한 번에 예약하는 원자적 스크립트. */
const BATCH_LIMIT_SCRIPT = `
  local now = tonumber(ARGV[1])
  local windowStart = tonumber(ARGV[2])
  local generalMax = tonumber(ARGV[3])
  local windowMs = tonumber(ARGV[4])
  local minInterval = tonumber(ARGV[5])
  local dailyMax = tonumber(ARGV[6])
  local engagementTtl = tonumber(ARGV[7])
  local requestCount = #KEYS / 2
  local results = {}

  for i = 1, requestCount do
    local generalKey = KEYS[(i - 1) * 2 + 1]
    local engagementKey = KEYS[(i - 1) * 2 + 2]
    local isEngagement = ARGV[7 + i] == "1"
    local limited = false
    local engagementCount = 0

    redis.call("ZREMRANGEBYSCORE", generalKey, "-inf", windowStart)
    if redis.call("ZCARD", generalKey) >= generalMax then
      limited = true
    end

    if not limited and isEngagement then
      engagementCount = tonumber(redis.call("HGET", engagementKey, "count") or "0")
      local lastSentAt = tonumber(redis.call("HGET", engagementKey, "lastSentAt") or "0")
      if engagementCount >= dailyMax or (lastSentAt > 0 and now - lastSentAt < minInterval) then
        limited = true
      end
    end

    if not limited then
      redis.call("ZADD", generalKey, now, now .. ":" .. i .. ":" .. math.random(1, 1000000))
      redis.call("PEXPIRE", generalKey, windowMs)
      if isEngagement then
        redis.call("HSET", engagementKey, "count", engagementCount + 1, "lastSentAt", now)
        redis.call("EXPIRE", engagementKey, engagementTtl)
      end
    end

    results[i] = limited and 1 or 0
  end

  return results
`;

function isRateLimitResult(
	value: unknown,
	expectedLength: number,
): value is Array<0 | 1> {
	return (
		Array.isArray(value) &&
		value.length === expectedLength &&
		value.every((item) => item === 0 || item === 1)
	);
}

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
		const windowStart = now - GENERAL.WINDOW_MS;

		try {
			const result = await this.#redis.eval(
				SLIDING_WINDOW_SCRIPT,
				1,
				key,
				now,
				windowStart,
				GENERAL.MAX,
				GENERAL.WINDOW_MS,
			);

			return result === 1;
		} catch (error) {
			this.#errorSampler.warn("PUSH_RATE_LIMIT", error);
			// fail-open: Redis 장애 시 발송 허용
			return false;
		}
	}

	async isEngagementRateLimited(
		userId: string,
		localDate: string,
	): Promise<boolean> {
		const key = `push-engagement:${userId}:${localDate}`;
		try {
			const result = await this.#redis.eval(
				ENGAGEMENT_LIMIT_SCRIPT,
				1,
				key,
				Date.now(),
				ENGAGEMENT.MIN_INTERVAL_MS,
				ENGAGEMENT.DAILY_MAX,
				ENGAGEMENT.TTL_SECONDS,
			);
			return result === 1;
		} catch (error) {
			this.#errorSampler.warn("PUSH_ENGAGEMENT_LIMIT", error);
			return false;
		}
	}

	async reserveBatch(
		requests: readonly PushRateLimitRequest[],
	): Promise<readonly boolean[]> {
		if (requests.length === 0) return [];

		const now = Date.now();
		const keys = requests.flatMap((request, index) => [
			`${this.#keyPrefix}${request.userId}`,
			request.engagementLocalDate
				? `push-engagement:${request.userId}:${request.engagementLocalDate}`
				: `push-engagement:unused:${index}`,
		]);
		const engagementFlags = requests.map((request) =>
			request.engagementLocalDate ? 1 : 0,
		);

		try {
			const result = await this.#redis.eval(
				BATCH_LIMIT_SCRIPT,
				keys.length,
				...keys,
				now,
				now - GENERAL.WINDOW_MS,
				GENERAL.MAX,
				GENERAL.WINDOW_MS,
				ENGAGEMENT.MIN_INTERVAL_MS,
				ENGAGEMENT.DAILY_MAX,
				ENGAGEMENT.TTL_SECONDS,
				...engagementFlags,
			);
			if (!isRateLimitResult(result, requests.length)) {
				this.#errorSampler.warn(
					"PUSH_BATCH_RATE_LIMIT",
					new Error("Redis rate-limit batch returned an invalid result"),
				);
				return requests.map(() => false);
			}
			return result.map((item) => item === 1);
		} catch (error) {
			this.#errorSampler.warn("PUSH_BATCH_RATE_LIMIT", error);
			return requests.map(() => false);
		}
	}
}

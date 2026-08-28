import { Logger } from "@nestjs/common";
import type Redis from "ioredis";

import { RedisErrorLogSampler } from "@/shared/infrastructure/redis/redis-error-log-sampler";

import type {
	EngagementPushRateLimitRequest,
	GeneralPushRateLimitRequest,
	PushRateLimitRequest,
	PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/services/push-rate-limit-policy";
import { PushRateLimiterKeys } from "./push-rate-limiter.keys";

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;
const RESERVATION_TTL_MS = ENGAGEMENT.RETENTION_MS;

interface LegacyPushRateLimitRequest {
	readonly userId: string;
	readonly reservationId?: string;
	readonly engagementLocalDate?: string;
}

/**
 * Lua 스크립트: Sorted Set 기반 슬라이딩 윈도우 rate limit
 *
 * KEYS[1] = rate limit key
 * KEYS[2] = dispatch reservation marker key
 * ARGV[1] = 현재 시각 (ms)
 * ARGV[2] = 윈도우 시작 시각 (ms)
 * ARGV[3] = 최대 허용 횟수
 * ARGV[4] = 윈도우 TTL (ms)
 * ARGV[5] = idempotent reservation ID (legacy 호출은 빈 문자열)
 * ARGV[6] = reservation marker TTL (ms)
 *
 * Returns: 1 = rate limited, 0 = allowed
 */
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local reservationKey = KEYS[2]
  local now = tonumber(ARGV[1])
  local windowStart = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local windowMs = tonumber(ARGV[4])
  local reservationId = ARGV[5]
  local reservationTtl = tonumber(ARGV[6])

  -- 윈도우 밖 엔트리 제거
  redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart)

  if reservationId ~= "" and (
    redis.call("EXISTS", reservationKey) == 1 or redis.call("ZSCORE", key, reservationId)
  ) then
    return 0
  end

  -- 현재 카운트 확인
  local count = redis.call("ZCARD", key)

  if count >= limit then
    return 1
  end

  -- 새 엔트리 추가 (member를 고유하게 만들기 위해 now + random)
  local member = reservationId ~= "" and reservationId or now .. ":" .. math.random(1, 1000000)
  redis.call("ZADD", key, now, member)
  redis.call("PEXPIRE", key, windowMs)
  if reservationId ~= "" then
    redis.call("SET", reservationKey, "1", "PX", reservationTtl)
  end

  return 0
`;

const ENGAGEMENT_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local reservationKey = KEYS[2]
  local now = tonumber(ARGV[1])
  local minInterval = tonumber(ARGV[2])
  local dailyMax = tonumber(ARGV[3])
  local ttlSeconds = tonumber(ARGV[4])
  local reservationId = ARGV[5]
  local reservationTtl = tonumber(ARGV[6])
  local reservationField = "reservation:" .. reservationId

  if reservationId ~= "" and (
    redis.call("EXISTS", reservationKey) == 1 or
    redis.call("HEXISTS", key, reservationField) == 1
  ) then
    return 0
  end
  local count = tonumber(redis.call("HGET", key, "count") or "0")
  local lastSentAt = tonumber(redis.call("HGET", key, "lastSentAt") or "0")

  if count >= dailyMax or (lastSentAt > 0 and now - lastSentAt < minInterval) then
    return 1
  end

  redis.call("HSET", key, "count", count + 1, "lastSentAt", now)
  if reservationId ~= "" then
    redis.call("HSET", key, reservationField, now)
    redis.call("SET", reservationKey, "1", "PX", reservationTtl)
  end
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
  local reservationTtl = tonumber(ARGV[8])
  local requestCount = #KEYS / 4
  local results = {}

  for i = 1, requestCount do
    local generalKey = KEYS[(i - 1) * 4 + 1]
    local engagementKey = KEYS[(i - 1) * 4 + 2]
    local generalReservationKey = KEYS[(i - 1) * 4 + 3]
    local engagementReservationKey = KEYS[(i - 1) * 4 + 4]
    local isEngagement = ARGV[8 + i] == "1"
    local reservationId = ARGV[8 + requestCount + i]
    local reservationField = "reservation:" .. reservationId
    local limited = false
    local generalReserved = false
    local engagementReserved = false
    local engagementCount = 0

    redis.call("ZREMRANGEBYSCORE", generalKey, "-inf", windowStart)
    if reservationId ~= "" and (
      redis.call("EXISTS", generalReservationKey) == 1 or
      redis.call("ZSCORE", generalKey, reservationId)
    ) then
      generalReserved = true
    end
    if isEngagement and reservationId ~= "" and (
      redis.call("EXISTS", engagementReservationKey) == 1 or
      redis.call("HEXISTS", engagementKey, reservationField) == 1
    ) then
      engagementReserved = true
    end
    if not generalReserved and redis.call("ZCARD", generalKey) >= generalMax then
      limited = true
    end

    if not limited and isEngagement and not engagementReserved then
      engagementCount = tonumber(redis.call("HGET", engagementKey, "count") or "0")
      local lastSentAt = tonumber(redis.call("HGET", engagementKey, "lastSentAt") or "0")
      if engagementCount >= dailyMax or (lastSentAt > 0 and now - lastSentAt < minInterval) then
        limited = true
      end
    end

    if not limited then
      if not generalReserved then
        local member = reservationId ~= "" and reservationId or now .. ":" .. i .. ":" .. math.random(1, 1000000)
        redis.call("ZADD", generalKey, now, member)
        redis.call("PEXPIRE", generalKey, windowMs)
        if reservationId ~= "" then
          redis.call("SET", generalReservationKey, "1", "PX", reservationTtl)
        end
      end
      if isEngagement and not engagementReserved then
        redis.call("HSET", engagementKey, "count", engagementCount + 1, "lastSentAt", now)
        if reservationId ~= "" then
          redis.call("HSET", engagementKey, reservationField, now)
          redis.call("SET", engagementReservationKey, "1", "PX", reservationTtl)
        end
        redis.call("EXPIRE", engagementKey, engagementTtl)
      end
    end

    results[i] = limited and 1 or 0
  end

  return results
`;

function isRateLimitResult(value: unknown, expectedLength: number): value is Array<0 | 1> {
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
export class RedisPushRateLimiter implements PushRateLimiterPort {
	readonly #logger = new Logger(RedisPushRateLimiter.name);
	readonly #redis: Redis;
	readonly #errorSampler = new RedisErrorLogSampler(this.#logger);

	constructor(redis: Redis) {
		this.#redis = redis;
	}

	async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
		return this.#reserveGeneral(request.userId, this.#reservationId(request.dispatchId));
	}

	/** @deprecated 테스트 호환 전용. 애플리케이션 포트에서는 dispatchId 기반 API를 사용한다. */
	async isRateLimited(userId: string, reservationId?: string): Promise<boolean> {
		return this.#reserveGeneral(userId, reservationId);
	}

	async #reserveGeneral(userId: string, reservationId?: string): Promise<boolean> {
		const key = PushRateLimiterKeys.general(userId);
		const reservationKey = reservationId
			? PushRateLimiterKeys.generalReservation(userId, reservationId)
			: PushRateLimiterKeys.reservationPlaceholder("general");
		const now = Date.now();
		const windowStart = now - GENERAL.WINDOW_MS;

		try {
			const result = await this.#redis.eval(
				SLIDING_WINDOW_SCRIPT,
				2,
				key,
				reservationKey,
				now,
				windowStart,
				GENERAL.MAX,
				GENERAL.WINDOW_MS,
				reservationId ?? "",
				RESERVATION_TTL_MS,
			);

			return result === 1;
		} catch (error) {
			this.#errorSampler.warn("PUSH_RATE_LIMIT", error);
			// fail-open: Redis 장애 시 발송 허용
			return false;
		}
	}

	async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
		return this.#reserveEngagement(
			request.userId,
			request.localDate,
			this.#reservationId(request.dispatchId),
		);
	}

	/** @deprecated 테스트 호환 전용. 애플리케이션 포트에서는 dispatchId 기반 API를 사용한다. */
	async isEngagementRateLimited(
		userId: string,
		localDate: string,
		reservationId?: string,
	): Promise<boolean> {
		return this.#reserveEngagement(userId, localDate, reservationId);
	}

	async #reserveEngagement(
		userId: string,
		localDate: string,
		reservationId?: string,
	): Promise<boolean> {
		const key = PushRateLimiterKeys.engagement(userId, localDate);
		const reservationKey = reservationId
			? PushRateLimiterKeys.engagementReservation(userId, reservationId)
			: PushRateLimiterKeys.reservationPlaceholder("engagement");
		try {
			const result = await this.#redis.eval(
				ENGAGEMENT_LIMIT_SCRIPT,
				2,
				key,
				reservationKey,
				Date.now(),
				ENGAGEMENT.MIN_INTERVAL_MS,
				ENGAGEMENT.DAILY_MAX,
				ENGAGEMENT.TTL_SECONDS,
				reservationId ?? "",
				RESERVATION_TTL_MS,
			);
			return result === 1;
		} catch (error) {
			this.#errorSampler.warn("PUSH_ENGAGEMENT_LIMIT", error);
			return false;
		}
	}

	async reserveBatch(
		requests: readonly (PushRateLimitRequest | LegacyPushRateLimitRequest)[],
	): Promise<readonly boolean[]> {
		if (requests.length === 0) return [];

		const now = Date.now();
		const keys = requests.flatMap((request, index) => {
			const reservationId =
				"dispatchId" in request ? this.#reservationId(request.dispatchId) : request.reservationId;
			return [
				PushRateLimiterKeys.general(request.userId),
				request.engagementLocalDate
					? PushRateLimiterKeys.engagement(request.userId, request.engagementLocalDate)
					: PushRateLimiterKeys.engagementPlaceholder(index),
				reservationId
					? PushRateLimiterKeys.generalReservation(request.userId, reservationId)
					: PushRateLimiterKeys.reservationPlaceholder("general", index),
				reservationId
					? PushRateLimiterKeys.engagementReservation(request.userId, reservationId)
					: PushRateLimiterKeys.reservationPlaceholder("engagement", index),
			];
		});
		const engagementFlags = requests.map((request) => (request.engagementLocalDate ? 1 : 0));
		const reservationIds = requests.map((request) =>
			"dispatchId" in request
				? this.#reservationId(request.dispatchId)
				: (request.reservationId ?? ""),
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
				RESERVATION_TTL_MS,
				...engagementFlags,
				...reservationIds,
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

	#reservationId(dispatchId: number): string {
		return `push-dispatch-${dispatchId}`;
	}
}

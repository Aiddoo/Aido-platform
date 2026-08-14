import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";

import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler";
import type { ILockProvider } from "../interfaces/lock.interface";

/**
 * Lua 스크립트: compare-and-delete
 *
 * 저장된 값이 일치하는 경우에만 삭제 (다른 클라이언트의 락 실수 해제 방지)
 */
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Redis 분산 잠금 어댑터
 *
 * - SET NX PX 패턴으로 원자적 락 획득
 * - UUID 기반 값으로 안전한 해제 (Lua 스크립트)
 * - TTL 자동 만료로 데드락 방지
 * - 멀티 인스턴스 환경에서 안전
 *
 * 장애 정책 — fail-closed (ILockProvider 계약):
 * 락은 fail-open(장애인데 획득 성공 취급)이면 중복 알림 발송, 웹훅 동시
 * 처리 같은 사고로 이어진다. 장애 시 "잠겨있음"으로 취급해 소비처가
 * busy 경로(스킵/재시도)를 타게 한다:
 * - acquire: 실패 시 null (busy와 동일)
 * - release: 실패 시 무시 — TTL 자동 만료가 정리한다
 * - isLocked: 실패 시 true
 */
@Injectable()
export class RedisLockAdapter implements ILockProvider {
	readonly #logger = new Logger(RedisLockAdapter.name);
	readonly #redis: Redis;
	readonly #keyPrefix = "lock:";
	readonly #errorSampler: RedisErrorLogSampler;

	constructor(redis: Redis, errorSampler?: RedisErrorLogSampler) {
		this.#redis = redis;
		this.#errorSampler = errorSampler ?? new RedisErrorLogSampler(this.#logger);
	}

	async acquire(resource: string, ttlMs: number): Promise<(() => Promise<void>) | null> {
		const key = this.#keyPrefix + resource;
		const value = randomUUID();

		let result: string | null;
		try {
			result = await this.#redis.set(key, value, "PX", ttlMs, "NX");
		} catch (error) {
			// fail-closed: busy와 동일하게 취급 — 소비처가 스킵/재시도 경로를 탄다
			this.#errorSampler.warn("LOCK_ACQUIRE", error);
			return null;
		}

		if (result !== "OK") {
			this.#logger.debug(`LOCK_BUSY ${resource}`);
			return null;
		}

		this.#logger.debug(`LOCK_ACQUIRED ${resource} (TTL: ${ttlMs}ms)`);

		const release = async (): Promise<void> => {
			let released: unknown;
			try {
				released = await this.#redis.eval(RELEASE_SCRIPT, 1, key, value);
			} catch (error) {
				// 해제 실패는 무시 — TTL 자동 만료가 정리한다
				this.#errorSampler.warn("LOCK_RELEASE", error);
				return;
			}

			if (released === 1) {
				this.#logger.debug(`LOCK_RELEASED ${resource}`);
			} else {
				this.#logger.warn(`LOCK_RELEASE_SKIPPED ${resource} (expired or stolen)`);
			}
		};

		return release;
	}

	async isLocked(resource: string): Promise<boolean> {
		const key = this.#keyPrefix + resource;

		try {
			const exists = await this.#redis.exists(key);
			return exists === 1;
		} catch (error) {
			// fail-closed: 장애 시 잠긴 것으로 취급
			this.#errorSampler.warn("LOCK_IS_LOCKED", error);
			return true;
		}
	}
}

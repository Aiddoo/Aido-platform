import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
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
 */
@Injectable()
export class RedisLockAdapter implements ILockProvider {
	readonly #logger = new Logger(RedisLockAdapter.name);
	readonly #redis: Redis;
	readonly #keyPrefix = "lock:";

	constructor(redis: Redis) {
		this.#redis = redis;
	}

	async acquire(
		resource: string,
		ttlMs: number,
	): Promise<(() => Promise<void>) | null> {
		const key = this.#keyPrefix + resource;
		const value = randomUUID();

		const result = await this.#redis.set(key, value, "PX", ttlMs, "NX");

		if (result !== "OK") {
			this.#logger.debug(`LOCK_BUSY ${resource}`);
			return null;
		}

		this.#logger.debug(`LOCK_ACQUIRED ${resource} (TTL: ${ttlMs}ms)`);

		const release = async (): Promise<void> => {
			const released = await this.#redis.eval(RELEASE_SCRIPT, 1, key, value);
			if (released === 1) {
				this.#logger.debug(`LOCK_RELEASED ${resource}`);
			} else {
				this.#logger.warn(
					`LOCK_RELEASE_SKIPPED ${resource} (expired or stolen)`,
				);
			}
		};

		return release;
	}

	async isLocked(resource: string): Promise<boolean> {
		const key = this.#keyPrefix + resource;
		const exists = await this.#redis.exists(key);
		return exists === 1;
	}
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_COMMAND_CLIENT } from "../../redis/redis.constants";
import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler";
import type { IDedupProvider } from "../interfaces/dedup.interface";

/**
 * Redis Set 기반 중복 방지 어댑터
 *
 * - SMISMEMBER: 배치 멤버십 확인 (Redis 6.2+, ElastiCache 7.1 지원)
 * - SISMEMBER: 단건 멤버십 확인
 * - Pipeline(SADD + PEXPIRE): 원자적 멤버 추가 + TTL 갱신
 * - 멀티 인스턴스 환경에서 dedup 상태 공유
 * - Redis 장애 시 fail-open (DB unique index가 최종 방어선)
 */
@Injectable()
export class RedisDedupAdapter implements IDedupProvider {
	readonly #logger = new Logger(RedisDedupAdapter.name);
	readonly #redis: Redis;
	readonly #errorSampler = new RedisErrorLogSampler(this.#logger);

	constructor(@Inject(REDIS_COMMAND_CLIENT) redis: Redis) {
		this.#redis = redis;
	}

	async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
		if (members.length === 0) return new Set();

		const key = this.#key(setKey);

		try {
			const results = await this.#redis.smismember(key, ...members);
			return new Set(members.filter((_, i) => results[i] === 1));
		} catch (error) {
			this.#errorSampler.warn("DEDUP_FILTER_MEMBERS", error);
			return new Set();
		}
	}

	async isMember(setKey: string, member: string): Promise<boolean> {
		try {
			return (await this.#redis.sismember(this.#key(setKey), member)) === 1;
		} catch (error) {
			this.#errorSampler.warn("DEDUP_IS_MEMBER", error);
			return false;
		}
	}

	async addMembers(
		setKey: string,
		members: string[],
		ttlMs: number,
	): Promise<void> {
		if (members.length === 0) return;

		const key = this.#key(setKey);

		try {
			const pipeline = this.#redis.pipeline();
			pipeline.sadd(key, ...members);
			pipeline.pexpire(key, ttlMs);
			await pipeline.exec();
		} catch (error) {
			this.#errorSampler.warn("DEDUP_ADD_MEMBERS", error);
		}
	}

	#key(setKey: string): string {
		return setKey;
	}
}

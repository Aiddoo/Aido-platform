import { Inject, Injectable, Optional } from "@nestjs/common";

import { toErrorMessage } from "@/shared/application/utils/error-message.util";
import { REDIS_COMMAND_CLIENT } from "@/shared/infrastructure/redis/redis.constants";

export interface RedisInfoSource {
	info(section: "memory"): Promise<string>;
}

export type RedisEvictionPolicyInspection =
	| { state: "compatible"; policy: "noeviction" }
	| { state: "incompatible"; policy: string }
	| { state: "unknown"; reason: string };

/** BullMQ가 요구하는 Redis noeviction 정책을 읽기 전용 INFO로 검사한다. */
@Injectable()
export class RedisEvictionPolicyProbe {
	constructor(
		@Optional()
		@Inject(REDIS_COMMAND_CLIENT)
		private readonly redis: RedisInfoSource | null = null,
	) {}

	async inspect(): Promise<RedisEvictionPolicyInspection> {
		if (!this.redis) {
			return {
				state: "unknown",
				reason: "Redis command client unavailable",
			};
		}

		try {
			const memoryInfo = await this.redis.info("memory");
			const policyLine = memoryInfo
				.split(/\r?\n/)
				.find((line) => line.startsWith("maxmemory_policy:"));
			if (!policyLine) {
				return {
					state: "unknown",
					reason: "maxmemory_policy missing from INFO memory",
				};
			}

			const policy = policyLine.slice("maxmemory_policy:".length).trim();
			if (!policy) {
				return {
					state: "unknown",
					reason: "maxmemory_policy missing from INFO memory",
				};
			}

			if (policy === "noeviction") {
				return { state: "compatible", policy };
			}
			return { state: "incompatible", policy };
		} catch (error) {
			return { state: "unknown", reason: toErrorMessage(error) };
		}
	}
}

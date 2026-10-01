import { vi, type Mock } from "vitest";

import { RedisEvictionPolicyProbe, type RedisInfoSource } from "./redis-eviction-policy.probe.js";

describe("RedisEvictionPolicyProbe — BullMQ Redis 정책 검사", () => {
	function createProbe(info: Mock): RedisEvictionPolicyProbe {
		const redis: RedisInfoSource = { info };
		return new RedisEvictionPolicyProbe(redis);
	}

	it("maxmemory_policy가 noeviction이면 compatible을 반환한다", async () => {
		// Given
		const probe = createProbe(
			vi
				.fn()
				.mockResolvedValue(
					"# Memory\r\nused_memory_human:12.00M\r\nmaxmemory_policy:noeviction\r\n",
				),
		);

		// When
		const result = await probe.inspect();

		// Then
		expect(result).toEqual({ state: "compatible", policy: "noeviction" });
	});

	it("maxmemory_policy가 volatile-lru이면 incompatible을 반환한다", async () => {
		// Given
		const probe = createProbe(vi.fn().mockResolvedValue("maxmemory_policy:volatile-lru\n"));

		// When
		const result = await probe.inspect();

		// Then
		expect(result).toEqual({ state: "incompatible", policy: "volatile-lru" });
	});

	it("maxmemory_policy가 없으면 unknown을 반환한다", async () => {
		// Given
		const probe = createProbe(vi.fn().mockResolvedValue("used_memory:1024\n"));

		// When
		const result = await probe.inspect();

		// Then
		expect(result).toEqual({
			state: "unknown",
			reason: "maxmemory_policy missing from INFO memory",
		});
	});

	it("INFO 조회가 실패하면 예외 대신 unknown을 반환한다", async () => {
		// Given
		const probe = createProbe(vi.fn().mockRejectedValue(new Error("NOPERM INFO denied")));

		// When
		const result = await probe.inspect();

		// Then
		expect(result).toEqual({
			state: "unknown",
			reason: "NOPERM INFO denied",
		});
	});

	it("Redis command client가 없으면 명시적인 unknown을 반환한다", async () => {
		// Given
		const probe = new RedisEvictionPolicyProbe(null);

		// When
		const result = await probe.inspect();

		// Then
		expect(result).toEqual({
			state: "unknown",
			reason: "Redis command client unavailable",
		});
	});
});

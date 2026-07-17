/**
 * BullHealthIndicator 단위 테스트
 *
 * @description
 * Redis 다운은 태스크 재시작으로 해결되지 않으므로 queues 체크는 절대
 * 503(down)을 만들지 않는다 — ALB/ECS가 멀쩡한 태스크를 죽이는 것을 방지.
 * - ping 게이트: Redis 다운 시 큐 API를 호출하지 않고 up + degraded
 * - 큐 API가 느리거나 실패해도 up + degraded (타임아웃 2초)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test bull.health
 * ```
 */
import { HealthIndicatorService } from "@nestjs/terminus";
import { BullHealthIndicator, type QueueHealthSource } from "./bull.health";
import { RedisEvictionPolicyProbe } from "./redis-eviction-policy.probe";

interface FakeQueue extends QueueHealthSource {
	isPaused: jest.Mock;
	getJobCounts: jest.Mock;
}

function createFakeQueue(): FakeQueue {
	return {
		isPaused: jest.fn().mockResolvedValue(false),
		getJobCounts: jest
			.fn()
			.mockResolvedValue({ active: 1, waiting: 2, failed: 0 }),
	};
}

describe("BullHealthIndicator — BullMQ 큐 헬스 인디케이터", () => {
	let queues: [FakeQueue, FakeQueue, FakeQueue, FakeQueue];

	beforeEach(() => {
		queues = [
			createFakeQueue(),
			createFakeQueue(),
			createFakeQueue(),
			createFakeQueue(),
		];
	});

	function createIndicator(
		redis: { ping: jest.Mock } | null,
		probe = new RedisEvictionPolicyProbe({
			info: jest.fn().mockResolvedValue("maxmemory_policy:noeviction\n"),
		}),
	) {
		return new BullHealthIndicator(
			new HealthIndicatorService(),
			queues[0],
			queues[1],
			queues[2],
			queues[3],
			probe,
			redis,
		);
	}

	it("Redis ping 실패 시 큐 API를 호출하지 않고 up + degraded를 반환한다", async () => {
		// Given
		const redis = {
			ping: jest.fn().mockRejectedValue(new Error("Connection is closed.")),
		};
		const indicator = createIndicator(redis);

		// When
		const result = await indicator.isHealthy("queues");

		// Then — down이 아니라 up: Redis 다운은 재시작으로 해결 안 됨
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({ degraded: true });
		expect(queues[0].isPaused).not.toHaveBeenCalled();
		expect(queues[0].getJobCounts).not.toHaveBeenCalled();
	});

	it("Redis 정상 + 큐 정상이면 up과 큐 카운트를 반환한다", async () => {
		// Given
		const redis = { ping: jest.fn().mockResolvedValue("PONG") };
		const indicator = createIndicator(redis);

		// When
		const result = await indicator.isHealthy("queues");

		// Then
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({
			"ai-suggestion": { isPaused: false, active: 1, waiting: 2, failed: 0 },
		});
		expect(result.queues).not.toMatchObject({ degraded: true });
	});

	it("Redis 정책이 volatile-lru이면 큐 통계와 함께 up + degraded를 반환한다", async () => {
		// Given
		const redis = { ping: jest.fn().mockResolvedValue("PONG") };
		const probe = new RedisEvictionPolicyProbe({
			info: jest.fn().mockResolvedValue("maxmemory_policy:volatile-lru\n"),
		});
		const indicator = createIndicator(redis, probe);

		// When
		const result = await indicator.isHealthy("queues");

		// Then — HTTP 상태를 내리지 않고 기존 degraded 계약으로만 노출
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({
			degraded: true,
			reason: "redis maxmemory_policy incompatible with BullMQ: volatile-lru",
			"ai-suggestion": { isPaused: false, active: 1, waiting: 2, failed: 0 },
		});
	});

	it("Redis 정책을 확인할 수 없으면 up + degraded와 원인을 반환한다", async () => {
		// Given
		const redis = { ping: jest.fn().mockResolvedValue("PONG") };
		const probe = new RedisEvictionPolicyProbe({
			info: jest.fn().mockRejectedValue(new Error("NOPERM INFO denied")),
		});
		const indicator = createIndicator(redis, probe);

		// When
		const result = await indicator.isHealthy("queues");

		// Then
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({
			degraded: true,
			reason: "redis maxmemory_policy unknown: NOPERM INFO denied",
		});
	});

	it("Redis 클라이언트가 없으면(메모리 모드) ping 없이 큐를 검사한다", async () => {
		// Given
		const indicator = createIndicator(null);

		// When
		const result = await indicator.isHealthy("queues");

		// Then
		expect(result.queues?.status).toBe("up");
		expect(queues[0].getJobCounts).toHaveBeenCalled();
	});

	it("큐 API 실패 시에도 up + degraded를 반환한다 (down 금지)", async () => {
		// Given
		const redis = { ping: jest.fn().mockResolvedValue("PONG") };
		queues[1].getJobCounts.mockRejectedValue(new Error("queue broken"));
		const indicator = createIndicator(redis);

		// When
		const result = await indicator.isHealthy("queues");

		// Then
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({ degraded: true });
	});

	it("큐 API가 응답하지 않으면 2초 타임아웃 후 up + degraded를 반환한다", async () => {
		// Given
		jest.useFakeTimers();
		const redis = { ping: jest.fn().mockResolvedValue("PONG") };
		queues[0].isPaused.mockReturnValue(new Promise(() => {}));
		const indicator = createIndicator(redis);

		// When
		const pending = indicator.isHealthy("queues");
		await jest.advanceTimersByTimeAsync(2_000);
		const result = await pending;

		// Then
		expect(result.queues?.status).toBe("up");
		expect(result.queues).toMatchObject({ degraded: true });
		jest.useRealTimers();
	});
});

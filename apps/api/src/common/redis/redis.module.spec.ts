/**
 * RedisModule 단위 테스트
 *
 * @description
 * - forTesting이 두 토큰(REDIS_CLIENT, REDIS_COMMAND_CLIENT)을 모두 제공하는지
 * - onApplicationShutdown이 quit 실패/hang 시 disconnect로 폴백하는지
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test redis.module
 * ```
 */
import type { ValueProvider } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT, REDIS_COMMAND_CLIENT } from "./redis.constants";
import { RedisModule } from "./redis.module";

interface FakeRedis {
	status: string;
	quit: jest.Mock;
	disconnect: jest.Mock;
}

function createFakeRedis(overrides: Partial<FakeRedis> = {}): FakeRedis {
	return {
		status: "ready",
		quit: jest.fn().mockResolvedValue("OK"),
		disconnect: jest.fn(),
		...overrides,
	};
}

function asRedis(fake: FakeRedis): Redis {
	return fake as unknown as Redis;
}

describe("RedisModule — Redis 연결 모듈", () => {
	describe("forTesting", () => {
		it("클라이언트 하나만 주면 두 토큰 모두 같은 클라이언트를 제공한다", () => {
			// Given
			const client = asRedis(createFakeRedis());

			// When
			const dynamicModule = RedisModule.forTesting(client);

			// Then
			const providers = (dynamicModule.providers ?? []) as ValueProvider[];
			const bullProvider = providers.find((p) => p.provide === REDIS_CLIENT);
			const commandProvider = providers.find(
				(p) => p.provide === REDIS_COMMAND_CLIENT,
			);
			expect(bullProvider?.useValue).toBe(client);
			expect(commandProvider?.useValue).toBe(client);
			expect(dynamicModule.exports).toEqual(
				expect.arrayContaining([REDIS_CLIENT, REDIS_COMMAND_CLIENT]),
			);
		});

		it("명령용 클라이언트를 따로 주면 토큰별로 다른 클라이언트를 제공한다", () => {
			// Given
			const bullClient = asRedis(createFakeRedis());
			const commandClient = asRedis(createFakeRedis());

			// When
			const dynamicModule = RedisModule.forTesting(bullClient, commandClient);

			// Then
			const providers = (dynamicModule.providers ?? []) as ValueProvider[];
			const bullProvider = providers.find((p) => p.provide === REDIS_CLIENT);
			const commandProvider = providers.find(
				(p) => p.provide === REDIS_COMMAND_CLIENT,
			);
			expect(bullProvider?.useValue).toBe(bullClient);
			expect(commandProvider?.useValue).toBe(commandClient);
		});
	});

	describe("onApplicationShutdown", () => {
		it("quit이 성공하면 disconnect를 호출하지 않는다", async () => {
			// Given
			const bullClient = createFakeRedis();
			const commandClient = createFakeRedis();
			const module = new RedisModule(
				asRedis(bullClient),
				asRedis(commandClient),
			);

			// When
			await module.onApplicationShutdown();

			// Then
			expect(bullClient.quit).toHaveBeenCalledTimes(1);
			expect(commandClient.quit).toHaveBeenCalledTimes(1);
			expect(bullClient.disconnect).not.toHaveBeenCalled();
			expect(commandClient.disconnect).not.toHaveBeenCalled();
		});

		it("quit이 reject되면 disconnect로 강제 종료한다", async () => {
			// Given
			const bullClient = createFakeRedis({
				quit: jest.fn().mockRejectedValue(new Error("Connection is closed.")),
			});
			const module = new RedisModule(asRedis(bullClient), null);

			// When
			await module.onApplicationShutdown();

			// Then
			expect(bullClient.disconnect).toHaveBeenCalledTimes(1);
		});

		it("quit이 응답하지 않으면(hang) 타임아웃 후 disconnect로 폴백한다", async () => {
			// Given — Redis 다운 중 종료: 오프라인 큐에 걸린 quit은 영원히 pending
			jest.useFakeTimers();
			const bullClient = createFakeRedis({
				quit: jest.fn().mockReturnValue(new Promise(() => {})),
			});
			const module = new RedisModule(asRedis(bullClient), null);

			// When
			const shutdown = module.onApplicationShutdown();
			await jest.advanceTimersByTimeAsync(3_000);
			await shutdown;

			// Then
			expect(bullClient.disconnect).toHaveBeenCalledTimes(1);
			jest.useRealTimers();
		});

		it("이미 종료된(end) 클라이언트는 건드리지 않는다", async () => {
			// Given
			const endedClient = createFakeRedis({ status: "end" });
			const module = new RedisModule(asRedis(endedClient), null);

			// When
			await module.onApplicationShutdown();

			// Then
			expect(endedClient.quit).not.toHaveBeenCalled();
			expect(endedClient.disconnect).not.toHaveBeenCalled();
		});
	});
});

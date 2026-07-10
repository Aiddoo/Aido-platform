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
import type { Provider, ValueProvider } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT, REDIS_COMMAND_CLIENT } from "./redis.constants";
import { type RedisLifecycleClient, RedisModule } from "./redis.module";

interface FakeRedisClient extends RedisLifecycleClient {
	quit: jest.Mock;
	disconnect: jest.Mock;
}

function createFakeClient(
	overrides: Partial<FakeRedisClient> = {},
): FakeRedisClient {
	return {
		status: "ready",
		quit: jest.fn().mockResolvedValue("OK"),
		disconnect: jest.fn(),
		...overrides,
	};
}

function isValueProvider(provider: Provider): provider is ValueProvider {
	return typeof provider === "object" && "useValue" in provider;
}

function findUseValue(
	providers: Provider[] | undefined,
	token: symbol,
): unknown {
	return (providers ?? [])
		.filter(isValueProvider)
		.find((provider) => provider.provide === token)?.useValue;
}

describe("RedisModule — Redis 연결 모듈", () => {
	describe("forTesting", () => {
		let client: Redis;
		let commandClient: Redis;

		beforeEach(() => {
			// lazyConnect: 명령 실행 전까지 실제 연결을 만들지 않음
			client = new Redis({ lazyConnect: true });
			commandClient = new Redis({ lazyConnect: true });
		});

		afterEach(() => {
			client.disconnect();
			commandClient.disconnect();
		});

		it("클라이언트 하나만 주면 두 토큰 모두 같은 클라이언트를 제공한다", () => {
			// When
			const dynamicModule = RedisModule.forTesting(client);

			// Then
			expect(findUseValue(dynamicModule.providers, REDIS_CLIENT)).toBe(client);
			expect(findUseValue(dynamicModule.providers, REDIS_COMMAND_CLIENT)).toBe(
				client,
			);
			expect(dynamicModule.exports).toEqual(
				expect.arrayContaining([REDIS_CLIENT, REDIS_COMMAND_CLIENT]),
			);
		});

		it("명령용 클라이언트를 따로 주면 토큰별로 다른 클라이언트를 제공한다", () => {
			// When
			const dynamicModule = RedisModule.forTesting(client, commandClient);

			// Then
			expect(findUseValue(dynamicModule.providers, REDIS_CLIENT)).toBe(client);
			expect(findUseValue(dynamicModule.providers, REDIS_COMMAND_CLIENT)).toBe(
				commandClient,
			);
		});
	});

	describe("onApplicationShutdown", () => {
		it("quit이 성공하면 disconnect를 호출하지 않는다", async () => {
			// Given
			const bullClient = createFakeClient();
			const commandClient = createFakeClient();
			const module = new RedisModule(bullClient, commandClient);

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
			const bullClient = createFakeClient({
				quit: jest.fn().mockRejectedValue(new Error("Connection is closed.")),
			});
			const module = new RedisModule(bullClient, null);

			// When
			await module.onApplicationShutdown();

			// Then
			expect(bullClient.disconnect).toHaveBeenCalledTimes(1);
		});

		it("quit이 응답하지 않으면(hang) 타임아웃 후 disconnect로 폴백한다", async () => {
			// Given — Redis 다운 중 종료: 오프라인 큐에 걸린 quit은 영원히 pending
			jest.useFakeTimers();
			const bullClient = createFakeClient({
				quit: jest.fn().mockReturnValue(new Promise(() => {})),
			});
			const module = new RedisModule(bullClient, null);

			// When
			const shutdown = module.onApplicationShutdown();
			await jest.advanceTimersByTimeAsync(3_000);
			await shutdown;

			// Then
			expect(bullClient.disconnect).toHaveBeenCalledTimes(1);
			jest.useRealTimers();
		});

		it("두 번 호출돼도 quit/disconnect는 한 번만 실행된다 (멱등)", async () => {
			// Given — main.ts의 enableShutdownHooks + 자체 SIGTERM 핸들러가
			// app.close()를 중복 호출하는 상황
			const bullClient = createFakeClient({
				quit: jest.fn().mockReturnValue(
					new Promise((resolve) => {
						setTimeout(() => resolve("OK"), 10);
					}),
				),
			});
			const module = new RedisModule(bullClient, null);

			// When — 동시 중복 호출
			await Promise.all([
				module.onApplicationShutdown(),
				module.onApplicationShutdown(),
			]);

			// Then
			expect(bullClient.quit).toHaveBeenCalledTimes(1);
			expect(bullClient.disconnect).not.toHaveBeenCalled();
		});

		it("이미 종료된(end) 클라이언트는 건드리지 않는다", async () => {
			// Given
			const endedClient = createFakeClient({ status: "end" });
			const module = new RedisModule(endedClient, null);

			// When
			await module.onApplicationShutdown();

			// Then
			expect(endedClient.quit).not.toHaveBeenCalled();
			expect(endedClient.disconnect).not.toHaveBeenCalled();
		});
	});
});

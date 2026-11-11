/**
 * RedisModule 단위 테스트
 *
 * @description
 * - forTesting이 REDIS_COMMAND_CLIENT를 제공하는지
 * - onApplicationShutdown이 quit 실패/hang 시 disconnect로 폴백하는지
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test redis.module
 * ```
 */
import type { Provider, ValueProvider } from "@nestjs/common";
import { Redis } from "ioredis";
import { vi, type Mock } from "vitest";

import { REDIS_COMMAND_CLIENT } from "./redis.constants.js";
import { type RedisLifecycleClient, RedisModule } from "./redis.module.js";

interface FakeRedisClient extends RedisLifecycleClient {
  quit: Mock;
  disconnect: Mock;
}

function createFakeClient(overrides: Partial<FakeRedisClient> = {}): FakeRedisClient {
  return {
    status: "ready",
    quit: vi.fn().mockResolvedValue("OK"),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function isValueProvider(provider: Provider): provider is ValueProvider {
  return typeof provider === "object" && "useValue" in provider;
}

function findUseValue(providers: Provider[] | undefined, token: symbol): unknown {
  return (providers ?? []).filter(isValueProvider).find((provider) => provider.provide === token)
    ?.useValue;
}

describe("RedisModule — Redis 연결 모듈", () => {
  describe("forTesting", () => {
    it("주입한 클라이언트를 명령용 토큰으로 제공한다", () => {
      // Given
      const client = new Redis({ lazyConnect: true });

      // When
      const dynamicModule = RedisModule.forTesting(client);

      // Then
      expect(findUseValue(dynamicModule.providers, REDIS_COMMAND_CLIENT)).toBe(client);
      expect(dynamicModule.exports).toEqual([REDIS_COMMAND_CLIENT]);
      client.disconnect();
    });
  });

  describe("onApplicationShutdown", () => {
    it("quit이 성공하면 disconnect를 호출하지 않는다", async () => {
      // Given
      const commandClient = createFakeClient();
      const module = new RedisModule(commandClient);

      // When
      await module.onApplicationShutdown();

      // Then
      expect(commandClient.quit).toHaveBeenCalledTimes(1);
      expect(commandClient.disconnect).not.toHaveBeenCalled();
    });

    it("quit이 reject되면 disconnect로 강제 종료한다", async () => {
      // Given
      const commandClient = createFakeClient({
        quit: vi.fn().mockRejectedValue(new Error("Connection is closed.")),
      });
      const module = new RedisModule(commandClient);

      // When
      await module.onApplicationShutdown();

      // Then
      expect(commandClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it("quit이 응답하지 않으면(hang) 타임아웃 후 disconnect로 폴백한다", async () => {
      // Given — Redis 다운 중 종료: 오프라인 큐에 걸린 quit은 영원히 pending
      vi.useFakeTimers();
      const commandClient = createFakeClient({
        quit: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      const module = new RedisModule(commandClient);

      // When
      const shutdown = module.onApplicationShutdown();
      await vi.advanceTimersByTimeAsync(3000);
      await shutdown;

      // Then
      expect(commandClient.disconnect).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("두 번 호출돼도 quit/disconnect는 한 번만 실행된다 (멱등)", async () => {
      const commandClient = createFakeClient({
        quit: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            setTimeout(() => resolve("OK"), 10);
          }),
        ),
      });
      const module = new RedisModule(commandClient);

      // When — 동시 중복 호출
      await Promise.all([module.onApplicationShutdown(), module.onApplicationShutdown()]);

      // Then
      expect(commandClient.quit).toHaveBeenCalledTimes(1);
      expect(commandClient.disconnect).not.toHaveBeenCalled();
    });

    it("이미 종료된(end) 클라이언트는 건드리지 않는다", async () => {
      // Given
      const endedClient = createFakeClient({ status: "end" });
      const module = new RedisModule(endedClient);

      // When
      await module.onApplicationShutdown();

      // Then
      expect(endedClient.quit).not.toHaveBeenCalled();
      expect(endedClient.disconnect).not.toHaveBeenCalled();
    });
  });
});

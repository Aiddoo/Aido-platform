import { buildCommandRedisOptions, type RedisTimeoutSettings } from "./redis-client.factory.js";

describe("redis-client.factory — Redis 클라이언트 옵션 팩토리", () => {
  const baseSettings: RedisTimeoutSettings = {
    connectTimeoutMs: 5000,
    commandTimeoutMs: 1500,
  };

  describe("buildCommandRedisOptions (캐시/락/스로틀/dedup용)", () => {
    it("fail-fast 옵션을 적용한다 (오프라인 큐 비활성화 + 명령 타임아웃)", () => {
      // When
      const options = buildCommandRedisOptions(baseSettings);

      // Then
      expect(options.enableOfflineQueue).toBe(false);
      expect(options.commandTimeout).toBe(1500);
      expect(options.connectTimeout).toBe(5000);
      expect(options.maxRetriesPerRequest).toBe(1);
      expect(options.enableReadyCheck).toBe(true);
      expect(options.connectionName).toBe("aido-command");
    });

    it("설정된 타임아웃 값을 그대로 반영한다", () => {
      // Given
      const settings: RedisTimeoutSettings = {
        connectTimeoutMs: 3000,
        commandTimeoutMs: 800,
      };

      // When
      const options = buildCommandRedisOptions(settings);

      // Then
      expect(options.commandTimeout).toBe(800);
      expect(options.connectTimeout).toBe(3000);
    });
  });
});

/**
 * Redis 클라이언트 옵션 팩토리 단위 테스트
 *
 * @description
 * 연결 없이 순수 함수로 명령용 fail-fast 옵션(enableOfflineQueue: false + commandTimeout)을
 * 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test redis-client.factory
 * ```
 */
import { buildCommandRedisOptions, type RedisConnectionSettings } from "./redis-client.factory.js";

describe("redis-client.factory — Redis 클라이언트 옵션 팩토리", () => {
  const baseSettings: RedisConnectionSettings = {
    connectTimeoutMs: 5_000,
    commandTimeoutMs: 1_500,
  };

  describe("buildCommandRedisOptions (캐시/락/스로틀/dedup용)", () => {
    it("fail-fast 옵션을 적용한다 (오프라인 큐 비활성화 + 명령 타임아웃)", () => {
      // When
      const options = buildCommandRedisOptions(baseSettings);

      // Then
      expect(options.enableOfflineQueue).toBe(false);
      expect(options.commandTimeout).toBe(1_500);
      expect(options.connectTimeout).toBe(5_000);
      expect(options.maxRetriesPerRequest).toBe(1);
      expect(options.enableReadyCheck).toBe(true);
      expect(options.connectionName).toBe("aido-command");
    });

    it("설정된 타임아웃 값을 그대로 반영한다", () => {
      // Given
      const settings: RedisConnectionSettings = {
        connectTimeoutMs: 3_000,
        commandTimeoutMs: 800,
      };

      // When
      const options = buildCommandRedisOptions(settings);

      // Then
      expect(options.commandTimeout).toBe(800);
      expect(options.connectTimeout).toBe(3_000);
    });

    it("URL이 없으면 host/port 기본값을 포함한다", () => {
      // When
      const options = buildCommandRedisOptions(baseSettings);

      // Then
      expect(options.host).toBe("localhost");
      expect(options.port).toBe(6_379);
    });

    it("URL이 없으면 host/port/password/db를 옵션에 포함한다", () => {
      // Given
      const settings: RedisConnectionSettings = {
        ...baseSettings,
        host: "redis.internal",
        port: 6_380,
        password: "secret",
        db: 2,
      };

      // When
      const options = buildCommandRedisOptions(settings);

      // Then
      expect(options.host).toBe("redis.internal");
      expect(options.port).toBe(6_380);
      expect(options.password).toBe("secret");
      expect(options.db).toBe(2);
    });

    it("URL이 있으면 host/port를 옵션에 포함하지 않는다 (URL이 우선)", () => {
      // Given
      const settings: RedisConnectionSettings = {
        ...baseSettings,
        url: "redis://redis:6379",
        host: "ignored",
      };

      // When
      const options = buildCommandRedisOptions(settings);

      // Then
      expect(options.host).toBeUndefined();
      expect(options.port).toBeUndefined();
    });
  });
});

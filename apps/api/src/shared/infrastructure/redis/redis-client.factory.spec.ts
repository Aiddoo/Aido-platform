/**
 * Redis 클라이언트 옵션 팩토리 단위 테스트
 *
 * @description
 * 연결 없이 순수 함수로 BullMQ용/명령용 옵션을 검증합니다.
 * - BullMQ용: maxRetriesPerRequest는 반드시 null (BullMQ 요구사항)
 * - 명령용: fail-fast 옵션 (enableOfflineQueue: false + commandTimeout)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test redis-client.factory
 * ```
 */
import {
	buildBullRedisOptions,
	buildCommandRedisOptions,
	type RedisConnectionSettings,
} from "./redis-client.factory";

describe("redis-client.factory — Redis 클라이언트 옵션 팩토리", () => {
	const baseSettings: RedisConnectionSettings = {
		connectTimeoutMs: 5000,
		commandTimeoutMs: 1500,
	};

	describe("buildBullRedisOptions (BullMQ 전용)", () => {
		it("BullMQ 요구사항인 maxRetriesPerRequest: null을 유지한다", () => {
			// When
			const options = buildBullRedisOptions(baseSettings);

			// Then
			expect(options.maxRetriesPerRequest).toBeNull();
			expect(options.enableReadyCheck).toBe(true);
			expect(options.connectionName).toBe("aido-main");
		});

		it("명령 타임아웃/오프라인 큐 비활성화를 적용하지 않는다 (블로킹 명령 보호)", () => {
			// When
			const options = buildBullRedisOptions(baseSettings);

			// Then
			expect(options.commandTimeout).toBeUndefined();
			expect(options.enableOfflineQueue).toBeUndefined();
		});

		it("URL이 없으면 host/port/password/db를 옵션에 포함한다", () => {
			// Given
			const settings: RedisConnectionSettings = {
				...baseSettings,
				host: "redis.internal",
				port: 6380,
				password: "secret",
				db: 2,
			};

			// When
			const options = buildBullRedisOptions(settings);

			// Then
			expect(options.host).toBe("redis.internal");
			expect(options.port).toBe(6380);
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
			const options = buildBullRedisOptions(settings);

			// Then
			expect(options.host).toBeUndefined();
			expect(options.port).toBeUndefined();
		});

		it("URL과 host가 모두 없으면 localhost:6379 기본값을 사용한다", () => {
			// When
			const options = buildBullRedisOptions(baseSettings);

			// Then
			expect(options.host).toBe("localhost");
			expect(options.port).toBe(6379);
			expect(options.db).toBe(0);
		});
	});

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
			const settings: RedisConnectionSettings = {
				connectTimeoutMs: 3000,
				commandTimeoutMs: 800,
			};

			// When
			const options = buildCommandRedisOptions(settings);

			// Then
			expect(options.commandTimeout).toBe(800);
			expect(options.connectTimeout).toBe(3000);
		});

		it("URL이 없으면 host/port 기본값을 포함한다", () => {
			// When
			const options = buildCommandRedisOptions(baseSettings);

			// Then
			expect(options.host).toBe("localhost");
			expect(options.port).toBe(6379);
		});
	});
});

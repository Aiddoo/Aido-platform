import { InMemoryCacheAdapter } from "../../adapters/in-memory-cache.adapter";

describe("InMemoryCacheAdapter", () => {
	let cache: InMemoryCacheAdapter;

	beforeEach(() => {
		cache = new InMemoryCacheAdapter({
			defaultTtlMs: 1000,
			maxItems: 100,
		});
	});

	afterEach(async () => {
		await cache.reset();
		cache.onModuleDestroy();
	});

	// ============================================
	// get / set
	// ============================================

	describe("get/set", () => {
		it("값을 저장하고 조회할 수 있다", async () => {
			// Given
			const key = "key1";
			const value = { foo: "bar" };

			// When
			await cache.set(key, value);
			const result = await cache.get<{ foo: string }>(key);

			// Then
			expect(result).toEqual(value);
		});

		it("존재하지 않는 키를 조회하면 undefined를 반환한다", async () => {
			// Given
			const nonExistentKey = "non-existent";

			// When
			const result = await cache.get(nonExistentKey);

			// Then
			expect(result).toBeUndefined();
		});

		it("만료된 키를 조회하면 undefined를 반환한다", async () => {
			// Given
			const key = "key1";
			const value = "value";
			const ttlMs = 50;
			await cache.set(key, value, ttlMs);

			// When
			await new Promise((resolve) => setTimeout(resolve, 100));
			const result = await cache.get(key);

			// Then
			expect(result).toBeUndefined();
		});

		it("TTL을 지정하지 않으면 기본 TTL이 적용된다", async () => {
			// Given
			const key = "key1";
			const value = "value";

			// When
			await cache.set(key, value);
			const result = await cache.get(key);

			// Then
			expect(result).toBe(value);
		});

		it("다양한 데이터 타입을 저장하고 조회할 수 있다", async () => {
			// Given
			const testCases = [
				{ key: "string", value: "hello" },
				{ key: "number", value: 42 },
				{ key: "boolean", value: true },
				{ key: "array", value: [1, 2, 3] },
				{ key: "object", value: { a: 1, b: { c: 2 } } },
				{ key: "null", value: null },
			];

			// When & Then
			for (const { key, value } of testCases) {
				await cache.set(key, value);
				const result = await cache.get(key);
				if (value === null) {
					expect(result).toBeNull();
				} else {
					expect(result).toEqual(value);
				}
			}
		});

		it("동일한 키에 새로운 값을 저장하면 기존 값을 덮어쓴다", async () => {
			// Given
			const key = "key1";
			const oldValue = "old";
			const newValue = "new";
			await cache.set(key, oldValue);

			// When
			await cache.set(key, newValue);
			const result = await cache.get(key);

			// Then
			expect(result).toBe(newValue);
		});
	});

	// ============================================
	// del
	// ============================================

	describe("del", () => {
		it("키를 삭제할 수 있다", async () => {
			// Given
			const key = "key1";
			const value = "value";
			await cache.set(key, value);

			// When
			await cache.del(key);
			const result = await cache.get(key);

			// Then
			expect(result).toBeUndefined();
		});

		it("존재하지 않는 키를 삭제해도 에러가 발생하지 않는다", async () => {
			// Given
			const nonExistentKey = "non-existent";

			// When & Then
			await expect(cache.del(nonExistentKey)).resolves.not.toThrow();
		});
	});

	// ============================================
	// delByPattern
	// ============================================

	describe("delByPattern", () => {
		it("패턴에 매칭되는 키들을 삭제한다", async () => {
			// Given
			await cache.set("user:profile:1", "a");
			await cache.set("user:profile:2", "b");
			await cache.set("user:subscription:1", "c");
			const pattern = "user:profile:*";

			// When
			const count = await cache.delByPattern(pattern);

			// Then
			expect(count).toBe(2);
			expect(await cache.get("user:profile:1")).toBeUndefined();
			expect(await cache.get("user:profile:2")).toBeUndefined();
			expect(await cache.get("user:subscription:1")).toBe("c");
		});

		it("매칭되는 키가 없으면 0을 반환한다", async () => {
			// Given
			await cache.set("key1", "value");
			const pattern = "other:*";

			// When
			const count = await cache.delByPattern(pattern);

			// Then
			expect(count).toBe(0);
		});

		it("복잡한 패턴을 처리할 수 있다", async () => {
			// Given
			await cache.set("friends:mutual:user1:user2", true);
			await cache.set("friends:mutual:user1:user3", true);
			await cache.set("friends:mutual:user2:user1", true);
			const pattern = "friends:mutual:user1:*";

			// When
			const count = await cache.delByPattern(pattern);

			// Then
			expect(count).toBe(2);
			expect(await cache.get("friends:mutual:user1:user2")).toBeUndefined();
			expect(await cache.get("friends:mutual:user1:user3")).toBeUndefined();
			expect(await cache.get("friends:mutual:user2:user1")).toBe(true);
		});

		it("다중 와일드카드 패턴을 처리할 수 있다", async () => {
			// Given
			await cache.set("stats:daily:user1:2025-01-26:todo", 5);
			await cache.set("stats:daily:user1:2025-01-26:cheer", 3);
			await cache.set("stats:daily:user2:2025-01-26:todo", 2);
			const pattern = "stats:daily:user1:*:*";

			// When
			const count = await cache.delByPattern(pattern);

			// Then
			expect(count).toBe(2);
			expect(await cache.get("stats:daily:user2:2025-01-26:todo")).toBe(2);
		});
	});

	// ============================================
	// reset
	// ============================================

	describe("reset", () => {
		it("모든 키를 삭제한다", async () => {
			// Given
			await cache.set("key1", "a");
			await cache.set("key2", "b");

			// When
			await cache.reset();

			// Then
			expect(await cache.get("key1")).toBeUndefined();
			expect(await cache.get("key2")).toBeUndefined();
		});

		it("통계를 초기화한다", async () => {
			// Given
			await cache.get("miss");
			await cache.set("key1", "a");
			await cache.get("key1");

			// When
			await cache.reset();
			const stats = cache.getStats();

			// Then
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.keys).toBe(0);
		});
	});

	// ============================================
	// getStats
	// ============================================

	describe("getStats", () => {
		it("캐시 히트와 미스를 추적한다", async () => {
			// Given
			await cache.set("key1", "value");

			// When
			await cache.get("key1"); // hit
			await cache.get("key1"); // hit
			await cache.get("miss"); // miss
			const stats = cache.getStats();

			// Then
			expect(stats.hits).toBe(2);
			expect(stats.misses).toBe(1);
			expect(stats.keys).toBe(1);
		});

		it("저장된 키 개수를 추적한다", async () => {
			// Given
			await cache.set("key1", "a");
			await cache.set("key2", "b");
			await cache.set("key3", "c");

			// When
			const stats = cache.getStats();

			// Then
			expect(stats.keys).toBe(3);
		});

		it("메모리 사용량을 추정한다", async () => {
			// Given
			await cache.set("key1", "value");

			// When
			const stats = cache.getStats();

			// Then
			expect(stats.memoryUsage).toBeDefined();
			expect(stats.memoryUsage).toBeGreaterThan(0);
		});

		it("만료된 키 조회는 미스로 카운트된다", async () => {
			// Given
			await cache.set("key1", "value", 10);

			// When
			await new Promise((resolve) => setTimeout(resolve, 50));
			await cache.get("key1"); // expired -> miss
			const stats = cache.getStats();

			// Then
			expect(stats.misses).toBe(1);
			expect(stats.hits).toBe(0);
		});
	});

	// ============================================
	// FIFO eviction
	// ============================================

	describe("FIFO eviction", () => {
		it("최대 항목 수에 도달하면 가장 오래된 항목을 삭제한다", async () => {
			// Given
			const smallCache = new InMemoryCacheAdapter({
				defaultTtlMs: 10000,
				maxItems: 3,
			});
			await smallCache.set("key1", "a");
			await smallCache.set("key2", "b");
			await smallCache.set("key3", "c");

			// When
			await smallCache.set("key4", "d"); // key1 삭제됨

			// Then
			expect(await smallCache.get("key1")).toBeUndefined();
			expect(await smallCache.get("key2")).toBe("b");
			expect(await smallCache.get("key3")).toBe("c");
			expect(await smallCache.get("key4")).toBe("d");

			smallCache.onModuleDestroy();
		});

		it("최대 항목 수 제한을 유지한다", async () => {
			// Given
			const maxItems = 5;
			const smallCache = new InMemoryCacheAdapter({
				defaultTtlMs: 10000,
				maxItems,
			});

			// When
			for (let i = 0; i < 10; i++) {
				await smallCache.set(`key${i}`, `value${i}`);
			}
			const stats = smallCache.getStats();

			// Then
			expect(stats.keys).toBeLessThanOrEqual(maxItems);

			smallCache.onModuleDestroy();
		});
	});

	// ============================================
	// cleanup
	// ============================================

	describe("cleanup", () => {
		it("만료된 항목을 정리한다", async () => {
			// Given
			const testCache = new InMemoryCacheAdapter({
				defaultTtlMs: 50,
				maxItems: 100,
			});
			await testCache.set("key1", "value1", 10);
			await testCache.set("key2", "value2", 10);

			// When
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Then
			expect(await testCache.get("key1")).toBeUndefined();
			expect(await testCache.get("key2")).toBeUndefined();

			testCache.onModuleDestroy();
		});
	});

	// ============================================
	// edge cases
	// ============================================

	describe("edge cases", () => {
		it("빈 문자열 키를 처리할 수 있다", async () => {
			// Given
			const key = "";
			const value = "value";

			// When
			await cache.set(key, value);
			const result = await cache.get(key);

			// Then
			expect(result).toBe(value);
		});

		it("매우 긴 키를 처리할 수 있다", async () => {
			// Given
			const longKey = "a".repeat(1000);
			const value = "value";

			// When
			await cache.set(longKey, value);
			const result = await cache.get(longKey);

			// Then
			expect(result).toBe(value);
		});

		it("특수 문자가 포함된 키를 처리할 수 있다", async () => {
			// Given
			const specialKey = "key:with:colons:and/slashes\\and-dashes";
			const value = "value";

			// When
			await cache.set(specialKey, value);
			const result = await cache.get(specialKey);

			// Then
			expect(result).toBe(value);
		});

		it("TTL이 0이면 즉시 만료된다", async () => {
			// Given
			const key = "key1";
			const value = "value";
			const ttlMs = 0;

			// When
			await cache.set(key, value, ttlMs);
			await new Promise((resolve) => setTimeout(resolve, 1));
			const result = await cache.get(key);

			// Then
			expect(result).toBeUndefined();
		});

		it("undefined 값을 저장할 수 있다", async () => {
			// Given
			const key = "key1";
			const value = undefined;

			// When
			await cache.set(key, value);
			const result = await cache.get(key);

			// Then
			// undefined는 저장되지만 get은 miss와 동일하게 undefined 반환
			expect(result).toBeUndefined();
		});
	});
});

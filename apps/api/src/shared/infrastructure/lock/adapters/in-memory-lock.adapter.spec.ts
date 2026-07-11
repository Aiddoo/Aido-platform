/**
 * InMemoryLockAdapter 단위 테스트
 *
 * @description
 * InMemoryLockAdapter의 개별 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test in-memory-lock.adapter
 * ```
 */
import { InMemoryLockAdapter } from "./in-memory-lock.adapter";

describe("InMemoryLockAdapter — 인메모리 락 어댑터", () => {
	let lock: InMemoryLockAdapter;

	beforeEach(() => {
		jest.useFakeTimers();
		lock = new InMemoryLockAdapter({ cleanupIntervalMs: 30_000 });
	});

	afterEach(() => {
		lock.onModuleDestroy();
		jest.useRealTimers();
	});

	describe("acquire", () => {
		it("잠금을 획득하면 release 함수를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const ttlMs = 5000;

			// When
			const release = await lock.acquire(resource, ttlMs);

			// Then
			expect(release).not.toBeNull();
			expect(typeof release).toBe("function");
		});

		it("이미 잠긴 리소스에 대해 null을 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			await lock.acquire(resource, 5000);

			// When
			const secondAttempt = await lock.acquire(resource, 5000);

			// Then
			expect(secondAttempt).toBeNull();
		});

		it("release 후 동일 리소스를 재획득할 수 있다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const release = await lock.acquire(resource, 5000);
			expect(release).not.toBeNull();

			// When
			await release?.();
			const secondRelease = await lock.acquire(resource, 5000);

			// Then
			expect(secondRelease).not.toBeNull();
			expect(typeof secondRelease).toBe("function");
		});

		it("TTL 만료 후 자동으로 잠금이 해제된다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const ttlMs = 3000;
			await lock.acquire(resource, ttlMs);

			// When
			jest.advanceTimersByTime(ttlMs);
			const release = await lock.acquire(resource, 5000);

			// Then
			expect(release).not.toBeNull();
		});

		it("TTL이 만료되지 않은 동안에는 잠금이 유지된다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const ttlMs = 5000;
			await lock.acquire(resource, ttlMs);

			// When
			jest.advanceTimersByTime(ttlMs - 1);
			const secondAttempt = await lock.acquire(resource, 5000);

			// Then
			expect(secondAttempt).toBeNull();
		});

		it("서로 다른 리소스는 독립적으로 잠금을 획득할 수 있다", async () => {
			// Given
			const resource1 = "todo:123:reminder";
			const resource2 = "todo:456:reminder";

			// When
			const release1 = await lock.acquire(resource1, 5000);
			const release2 = await lock.acquire(resource2, 5000);

			// Then
			expect(release1).not.toBeNull();
			expect(release2).not.toBeNull();
		});
	});

	describe("isLocked", () => {
		it("잠겨있는 리소스에 대해 true를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			await lock.acquire(resource, 5000);

			// When
			const result = await lock.isLocked(resource);

			// Then
			expect(result).toBe(true);
		});

		it("잠기지 않은 리소스에 대해 false를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";

			// When
			const result = await lock.isLocked(resource);

			// Then
			expect(result).toBe(false);
		});

		it("release 후 false를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const release = await lock.acquire(resource, 5000);
			await release?.();

			// When
			const result = await lock.isLocked(resource);

			// Then
			expect(result).toBe(false);
		});

		it("TTL 만료 후 false를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const ttlMs = 3000;
			await lock.acquire(resource, ttlMs);

			// When
			jest.advanceTimersByTime(ttlMs);
			const result = await lock.isLocked(resource);

			// Then
			expect(result).toBe(false);
		});

		it("TTL 만료 전에는 true를 반환한다", async () => {
			// Given
			const resource = "todo:123:reminder";
			const ttlMs = 5000;
			await lock.acquire(resource, ttlMs);

			// When
			jest.advanceTimersByTime(ttlMs - 1);
			const result = await lock.isLocked(resource);

			// Then
			expect(result).toBe(true);
		});
	});

	describe("cleanup", () => {
		it("cleanup interval이 만료된 항목을 정리한다", async () => {
			// Given
			const resource1 = "todo:1:reminder";
			const resource2 = "todo:2:reminder";
			await lock.acquire(resource1, 5000);
			await lock.acquire(resource2, 10_000);

			// When — TTL 5초 경과 후 cleanup 주기(30초) 도달
			jest.advanceTimersByTime(30_000);

			// Then — resource1은 만료되어 정리됨, resource2는 아직 유효
			const isLocked1 = await lock.isLocked(resource1);
			const isLocked2 = await lock.isLocked(resource2);
			expect(isLocked1).toBe(false);
			expect(isLocked2).toBe(false); // 30초 > 10초이므로 둘 다 만료
		});

		it("cleanup이 아직 유효한 항목은 유지한다", async () => {
			// Given
			const resource = "todo:1:reminder";
			await lock.acquire(resource, 60_000); // 60초 TTL

			// When — cleanup 주기(30초) 도달
			jest.advanceTimersByTime(30_000);

			// Then — 60초 TTL이므로 아직 유효
			const result = await lock.isLocked(resource);
			expect(result).toBe(true);
		});
	});

	describe("onModuleDestroy", () => {
		it("cleanup interval을 정리한다", () => {
			// Given
			const adapter = new InMemoryLockAdapter({ cleanupIntervalMs: 30_000 });

			// When
			adapter.onModuleDestroy();

			// Then — clearInterval이 호출되었는지 간접 확인
			// cleanup이 더 이상 실행되지 않음을 검증
			// (interval이 정리되었으므로 advanceTimersByTime 후에도 에러 없이 동작)
			expect(() => jest.advanceTimersByTime(60_000)).not.toThrow();
		});
	});
});

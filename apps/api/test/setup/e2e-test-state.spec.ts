import { createE2eTestStateResetter } from "../e2e/helpers/e2e-test-state";

describe("E2E 테스트 상태 reset", () => {
	it("DB, cache, Redis, 공용 fake와 suite fake를 모두 초기화해야 한다", async () => {
		// Given - 상태를 가진 모든 테스트 의존성
		const cleanupDatabase = jest.fn().mockResolvedValue(undefined);
		const resetCache = jest.fn().mockResolvedValue(undefined);
		const flushRedis = jest.fn().mockResolvedValue("OK");
		const clearEmail = jest.fn();
		const clearOAuth = jest.fn();
		const clearPush = jest.fn();
		const clearSuiteFake = jest.fn();
		const reset = createE2eTestStateResetter({
			cleanupDatabase,
			resetCache,
			flushRedis,
			sharedResetters: [clearEmail, clearOAuth, clearPush],
			additionalResetters: [clearSuiteFake],
		});

		// When - 단일 reset 진입점 호출
		await reset();

		// Then - 모든 상태 저장소가 정확히 한 번 초기화
		expect(cleanupDatabase).toHaveBeenCalledTimes(1);
		expect(resetCache).toHaveBeenCalledTimes(1);
		expect(flushRedis).toHaveBeenCalledTimes(1);
		expect(clearEmail).toHaveBeenCalledTimes(1);
		expect(clearOAuth).toHaveBeenCalledTimes(1);
		expect(clearPush).toHaveBeenCalledTimes(1);
		expect(clearSuiteFake).toHaveBeenCalledTimes(1);
	});

	it("백그라운드 작업을 모두 기다린 뒤 DB를 초기화해야 한다", async () => {
		// Given - push 저장 작업이 아직 진행 중인 상태
		let backgroundWorkCompleted = false;
		const drainBackgroundWork = jest.fn(async () => {
			await Promise.resolve();
			backgroundWorkCompleted = true;
		});
		const cleanupDatabase = jest.fn(() => {
			expect(backgroundWorkCompleted).toBe(true);
		});
		const reset = createE2eTestStateResetter({
			drainBackgroundWork,
			cleanupDatabase,
			resetCache: jest.fn(),
			flushRedis: jest.fn(),
			sharedResetters: [],
		});

		// When
		await reset();

		// Then - truncate보다 drain이 항상 선행
		expect(drainBackgroundWork).toHaveBeenCalledTimes(1);
		expect(cleanupDatabase).toHaveBeenCalledTimes(1);
	});

	it("백그라운드 drain 실패 시 DB는 보호하고 나머지 상태를 초기화해야 한다", async () => {
		const drainError = new Error("drain failed");
		const drainBackgroundWork = jest.fn().mockRejectedValue(drainError);
		const cleanupDatabase = jest.fn();
		const resetCache = jest.fn().mockRejectedValue("cache failed");
		const flushRedis = jest.fn().mockResolvedValue("OK");
		const clearFake = jest.fn();
		const reset = createE2eTestStateResetter({
			drainBackgroundWork,
			cleanupDatabase,
			resetCache,
			flushRedis,
			sharedResetters: [clearFake],
		});

		await expect(reset()).rejects.toMatchObject({
			errors: [
				drainError,
				expect.objectContaining({ message: "cache failed" }),
			],
		});
		expect(cleanupDatabase).not.toHaveBeenCalled();
		expect(resetCache).toHaveBeenCalledTimes(1);
		expect(flushRedis).toHaveBeenCalledTimes(1);
		expect(clearFake).toHaveBeenCalledTimes(1);
	});
});

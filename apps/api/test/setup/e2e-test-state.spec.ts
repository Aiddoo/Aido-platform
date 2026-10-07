import { vi } from "vitest";

import { createE2eTestStateResetter } from "../e2e/helpers/e2e-test-state.js";

describe("E2E 테스트 상태 reset", () => {
  it("DB, cache, Redis, 공용 fake와 suite fake를 모두 초기화해야 한다", async () => {
    // Given - 상태를 가진 모든 테스트 의존성
    const cleanupDatabase = vi.fn().mockResolvedValue(undefined);
    const resetCache = vi.fn().mockResolvedValue(undefined);
    const flushRedis = vi.fn().mockResolvedValue("OK");
    const clearEmail = vi.fn();
    const clearOAuth = vi.fn();
    const clearPush = vi.fn();
    const clearSuiteFake = vi.fn();
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
    const drainBackgroundWork = vi.fn(async () => {
      await Promise.resolve();
      backgroundWorkCompleted = true;
    });
    const cleanupDatabase = vi.fn(() => {
      expect(backgroundWorkCompleted).toBe(true);
    });
    const reset = createE2eTestStateResetter({
      drainBackgroundWork,
      cleanupDatabase,
      resetCache: vi.fn(),
      flushRedis: vi.fn(),
      sharedResetters: [],
    });

    // When
    await reset();

    // Then - truncate보다 drain이 항상 선행
    expect(drainBackgroundWork).toHaveBeenCalledTimes(1);
    expect(cleanupDatabase).toHaveBeenCalledTimes(1);
  });

  it("백그라운드 drain이 실패해도 DB를 포함한 모든 상태를 초기화하고 에러를 보고해야 한다", async () => {
    // drain 실패 시 TRUNCATE를 건너뛰면 오염이 다음 테스트로 전파되므로
    // DB 정리는 항상 수행하고, drain 에러는 AggregateError로 함께 드러낸다
    const drainError = new Error("drain failed");
    const drainBackgroundWork = vi.fn().mockRejectedValue(drainError);
    const cleanupDatabase = vi.fn();
    const resetCache = vi.fn().mockRejectedValue("cache failed");
    const flushRedis = vi.fn().mockResolvedValue("OK");
    const clearFake = vi.fn();
    const reset = createE2eTestStateResetter({
      drainBackgroundWork,
      cleanupDatabase,
      resetCache,
      flushRedis,
      sharedResetters: [clearFake],
    });

    await expect(reset()).rejects.toMatchObject({
      errors: [drainError, expect.objectContaining({ message: "cache failed" })],
    });
    expect(cleanupDatabase).toHaveBeenCalledTimes(1);
    expect(resetCache).toHaveBeenCalledTimes(1);
    expect(flushRedis).toHaveBeenCalledTimes(1);
    expect(clearFake).toHaveBeenCalledTimes(1);
  });

  describe("시간 상한", () => {
    const neverSettles = () => new Promise<void>(() => undefined);
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("정착하지 않는 drain을 끊고 어느 단계였는지 말한다", async () => {
      const cleanupDatabase = vi.fn();
      const reset = createE2eTestStateResetter({
        drainBackgroundWork: neverSettles,
        cleanupDatabase,
        resetCache: vi.fn(),
        flushRedis: vi.fn(),
        sharedResetters: [],
        timeoutMs: 20,
      });

      const assertion = expect(reset()).rejects.toMatchObject({
        errors: [
          expect.objectContaining({ message: expect.stringMatching(/drainBackgroundWork.*20ms/) }),
        ],
      });
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
      // drain이 끊겨도 DB 정리는 여전히 수행된다 — 오염을 다음 테스트로 넘기지 않는다.
      expect(cleanupDatabase).toHaveBeenCalledTimes(1);
    });

    it("어느 단계가 멈추든 이름과 함께 실패한다", async () => {
      const reset = createE2eTestStateResetter({
        cleanupDatabase: vi.fn(),
        resetCache: neverSettles,
        flushRedis: vi.fn(),
        sharedResetters: [],
        timeoutMs: 20,
      });

      const assertion = expect(reset()).rejects.toMatchObject({
        errors: [expect.objectContaining({ message: expect.stringMatching(/resetCache.*20ms/) })],
      });
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
    });
    it("timeout 이후 같은 상태를 다시 사용하지 않는다", async () => {
      const cleanupDatabase = vi.fn();
      const reset = createE2eTestStateResetter({
        cleanupDatabase,
        resetCache: neverSettles,
        flushRedis: vi.fn(),
        sharedResetters: [],
        timeoutMs: 20,
      });
      const assertion = expect(reset()).rejects.toBeInstanceOf(AggregateError);
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
      await expect(reset()).rejects.toBeInstanceOf(AggregateError);
      expect(cleanupDatabase).toHaveBeenCalledTimes(1);
    });
  });
});

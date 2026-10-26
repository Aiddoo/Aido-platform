import { mockDeep } from "vitest-mock-extended";

import type { DatabaseService } from "#api/platform/database/database.service";
import { sqlQueryError } from "#test/mocks/database.mock";

import { PostgresPushRateLimiter, transactionRetryDelayMs } from "./postgres-push-rate-limiter.js";

describe("PostgresPushRateLimiter 재시도", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("실패한 시도마다 대기를 두 배로 늘리고 절반은 고정으로 보장한다", () => {
    // Given
    const attempts = [1, 2, 3, 4];
    // When
    const minimums = attempts.map((attempt) => transactionRetryDelayMs(attempt, () => 0));
    const maximums = attempts.map((attempt) => transactionRetryDelayMs(attempt, () => 1));
    // Then
    expect(minimums).toEqual([10, 20, 40, 80]);
    expect(maximums).toEqual([20, 40, 80, 160]);
  });

  it("Serializable 충돌 뒤 즉시 재시도하지 않고 백오프 후 새 트랜잭션을 연다", async () => {
    // Given
    vi.useFakeTimers();
    const database = mockDeep<DatabaseService>();
    database.db.transaction
      .mockRejectedValueOnce(sqlQueryError("40001"))
      .mockResolvedValueOnce([false]);
    const limiter = new PostgresPushRateLimiter(database);
    // When
    const decision = limiter.reserveGeneral({ dispatchId: 1, userId: "user-1" });
    await vi.advanceTimersByTimeAsync(0);
    const attemptsBeforeBackoff = database.db.transaction.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20);
    // Then
    expect(attemptsBeforeBackoff).toBe(1);
    await expect(decision).resolves.toBe(false);
    expect(database.db.transaction).toHaveBeenCalledTimes(2);
  });

  it("재시도 대상이 아닌 오류는 대기 없이 그대로 올린다", async () => {
    // Given
    const database = mockDeep<DatabaseService>();
    const error = sqlQueryError("23503");
    database.db.transaction.mockRejectedValueOnce(error);
    const limiter = new PostgresPushRateLimiter(database);
    // When
    const decision = limiter.reserveGeneral({ dispatchId: 1, userId: "user-1" });
    // Then
    await expect(decision).rejects.toBe(error);
    expect(database.db.transaction).toHaveBeenCalledTimes(1);
  });
});

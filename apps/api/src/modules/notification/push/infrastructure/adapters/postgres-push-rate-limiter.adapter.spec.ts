import { DatabaseError, Pool } from "pg";
import { vi } from "vitest";

import { createDatabase, type Database } from "#api/platform/database/database.client";

import {
  PostgresPushRateLimiterAdapter,
  transactionRetryDelayMs,
} from "./postgres-push-rate-limiter.adapter.js";

function sqlQueryError(code: string): DatabaseError {
  return Object.assign(new DatabaseError("database error", 0, "error"), { code });
}

// 연결하지 않는 pool이다. 트랜잭션은 spec마다 결과를 정해 SQL 없이 재시도 판단만 본다
function createUnconnectedDatabase(): Database {
  return createDatabase(new Pool());
}

describe("PostgresPushRateLimiterAdapter 재시도", () => {
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
    const database = createUnconnectedDatabase();
    const transaction = vi
      .spyOn(database, "transaction")
      .mockRejectedValueOnce(sqlQueryError("40001"))
      .mockResolvedValueOnce([false]);
    const limiter = new PostgresPushRateLimiterAdapter(database);
    // When
    const decision = limiter.reserveGeneral({ dispatchId: 1, userId: "user-1" });
    await vi.advanceTimersByTimeAsync(0);
    const attemptsBeforeBackoff = transaction.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20);
    // Then
    expect(attemptsBeforeBackoff).toBe(1);
    await expect(decision).resolves.toBe(false);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("재시도 대상이 아닌 오류는 대기 없이 그대로 올린다", async () => {
    // Given
    const database = createUnconnectedDatabase();
    const error = sqlQueryError("23503");
    const transaction = vi.spyOn(database, "transaction").mockRejectedValueOnce(error);
    const limiter = new PostgresPushRateLimiterAdapter(database);
    // When
    const decision = limiter.reserveGeneral({ dispatchId: 1, userId: "user-1" });
    // Then
    await expect(decision).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

import {
  resolveTestDatabaseWorkerCount,
  selectWorkerDatabaseUri,
} from "./test-database-workers.js";

describe("테스트 DB worker 수", () => {
  it("환경변수가 있으면 그 값을 사용해야 한다", () => {
    // Given
    const env = { AIDO_TEST_DB_WORKERS: "3" };

    // When & Then
    expect(resolveTestDatabaseWorkerCount(env, 32)).toBe(3);
  });

  it.each([
    [1, 2],
    [4, 2],
    [8, 4],
    [64, 4],
  ])("CPU %i개이면 기본 %i개를 사용해야 한다", (cpuCount, expected) => {
    // Given & When & Then
    expect(resolveTestDatabaseWorkerCount({}, cpuCount)).toBe(expected);
  });

  it("양의 정수가 아닌 값은 거부해야 한다", () => {
    // Given & When & Then
    expect(() => resolveTestDatabaseWorkerCount({ AIDO_TEST_DB_WORKERS: "0" }, 8)).toThrow(
      "AIDO_TEST_DB_WORKERS",
    );
  });
});

describe("worker별 DB 선택", () => {
  const uris = ["db-1", "db-2"];

  it("VITEST_POOL_ID에 대응하는 DB를 골라야 한다", () => {
    // Given & When & Then
    expect(selectWorkerDatabaseUri(uris, { VITEST_POOL_ID: "2" })).toBe("db-2");
  });

  it("VITEST_POOL_ID가 없으면 VITEST_WORKER_ID를 사용해야 한다", () => {
    // Given & When & Then
    expect(selectWorkerDatabaseUri(uris, { VITEST_WORKER_ID: "1" })).toBe("db-1");
  });

  it("식별자가 없으면 거부해야 한다", () => {
    // Given & When & Then
    expect(() => selectWorkerDatabaseUri(uris, {})).toThrow("VITEST_POOL_ID");
  });
});

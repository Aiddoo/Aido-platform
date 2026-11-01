import type { Pool, QueryResult } from "pg";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createDatabase } from "#api/platform/database/database.client";
import { postgresError } from "#test/mocks/drizzle.mock";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "./test-database.js";

const MANAGED_ENV = {
  DATABASE_URL: "postgresql://test_user:test_password@localhost:55432/aido_test_abc123",
  AIDO_TEST_DB_MANAGED: "1",
};

type StatementMock = ReturnType<typeof vi.fn<(text: string) => Promise<QueryResult>>>;

function queryResult(rows: object[] = []): QueryResult {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}

function queryText(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }
  if (
    typeof input === "object" &&
    input !== null &&
    "text" in input &&
    typeof input.text === "string"
  ) {
    return input.text;
  }
  return "";
}

/** 실제 Drizzle 클라이언트에 가짜 pg Pool을 연결해 SQL 종류별 응답을 제어한다. */
function createFakeTestDatabaseClient(handlers: {
  probe?: StatementMock;
  truncate?: StatementMock;
}): TestDatabaseClient & { close: ReturnType<typeof vi.fn<() => Promise<void>>> } {
  const pool = mock<Pool>();
  pool.query.mockImplementation(async (input: unknown) => {
    const text = queryText(input);
    if (text.includes("information_schema")) {
      return queryResult([{ table_name: "Todo" }]);
    }
    if (text.startsWith("TRUNCATE")) {
      return (handlers.truncate ?? vi.fn().mockResolvedValue(queryResult()))(text);
    }
    return (handlers.probe ?? vi.fn().mockResolvedValue(queryResult([{ "?column?": 1 }])))(text);
  });
  return Object.assign(createDatabase(pool), {
    close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  });
}

function deadlock() {
  return postgresError("40P01");
}

describe("TestDatabase", () => {
  it("비관리 DATABASE_URL에서 DB 연결을 시도하지 않아야 한다", async () => {
    // Given - localhost fallback URL과 client factory spy
    const createTestDatabaseClient = vi.fn();
    const testDatabase = new TestDatabase({
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido_test",
      },
      createClient: createTestDatabaseClient,
    });

    // When & Then - marker/name 검증에서 즉시 중단
    await expect(testDatabase.start()).rejects.toThrow("AIDO_TEST_DB_MANAGED=1");
    expect(createTestDatabaseClient).not.toHaveBeenCalled();
  });

  describe("연결 probe 실패 생명주기", () => {
    it("SELECT 1이 실패하면 client를 닫고 미시작 상태로 돌아가 새 client로 재시도한다", async () => {
      // Given - client는 생성됐지만 첫 연결 확인이 실패한다
      const probeError = new Error("synthetic probe failure");
      const firstClient = createFakeTestDatabaseClient({
        probe: vi.fn<(text: string) => Promise<QueryResult>>().mockRejectedValueOnce(probeError),
      });
      const retryClient = createFakeTestDatabaseClient({});
      const createClient = vi
        .fn<(uri: string) => TestDatabaseClient>()
        .mockReturnValueOnce(firstClient)
        .mockReturnValueOnce(retryClient);
      const database = new TestDatabase({ env: MANAGED_ENV, createClient });
      try {
        // When - 실제 start의 SELECT 1 경로에서 실패한다
        await expect(database.start()).rejects.toMatchObject({ cause: probeError });
        // Then - 부분 자원을 닫고 client와 연결 정보를 공개하지 않는다
        expect.soft(firstClient.close).toHaveBeenCalledTimes(1);
        expect.soft(() => database.getClient()).toThrow("TestDatabase not started");
        expect.soft(() => database.getConnectionUri()).toThrow("TestDatabase not started");
        await expect.soft(database.start()).resolves.toBe(retryClient);
        expect.soft(database.getClient()).toBe(retryClient);
      } finally {
        await database.stop();
      }
    });

    it("실패 client의 close도 실패하면 정리 실패로 원래 probe 오류를 덮지 않는다", async () => {
      // Given - 연결 확인과 부분 client 정리 모두 실패한다
      const probeError = new Error("synthetic original probe failure");
      const failedClient = createFakeTestDatabaseClient({
        probe: vi.fn<(text: string) => Promise<QueryResult>>().mockRejectedValueOnce(probeError),
      });
      failedClient.close.mockRejectedValueOnce(new Error("synthetic close failure"));
      const database = new TestDatabase({ env: MANAGED_ENV, createClient: () => failedClient });
      try {
        // When - 실제 시작 실패의 cleanup 경로를 실행한다
        await expect(database.start()).rejects.toMatchObject({ cause: probeError });
        // Then - close 시도는 보장하고 실패한 client/URI는 미시작 상태다
        expect.soft(failedClient.close).toHaveBeenCalledTimes(1);
        expect.soft(() => database.getClient()).toThrow("TestDatabase not started");
        expect.soft(() => database.getConnectionUri()).toThrow("TestDatabase not started");
      } finally {
        await database.stop().catch(() => undefined);
      }
    });
  });

  // TRUNCATE는 ACCESS EXCLUSIVE 락을 잡는다. 앞 테스트가 남긴 작업과 겹치면 교착으로
  // 튕기는데, 이건 드문 경합이지 설계 결함이 아니다 — 물러섰다 다시 잡는 게 맞다.
  describe("TRUNCATE 교착 재시도", () => {
    async function startWith(truncate: StatementMock) {
      const testDatabase = new TestDatabase({
        env: MANAGED_ENV,
        createClient: () => createFakeTestDatabaseClient({ truncate }),
      });
      await testDatabase.start();
      return testDatabase;
    }

    it("교착으로 튕기면 다시 시도해 끝내 정리한다", async () => {
      const truncate = vi
        .fn<(text: string) => Promise<QueryResult>>()
        .mockRejectedValueOnce(deadlock())
        .mockResolvedValueOnce(queryResult());
      const testDatabase = await startWith(truncate);

      await expect(testDatabase.cleanup()).resolves.toBeUndefined();
      expect(truncate).toHaveBeenCalledTimes(2);
    });

    it("교착이 아닌 실패는 즉시 올린다 — 감추면 원인을 잃는다", async () => {
      const truncate = vi
        .fn<(text: string) => Promise<QueryResult>>()
        .mockRejectedValue(new Error("relation does not exist"));
      const testDatabase = await startWith(truncate);

      await expect(testDatabase.cleanup()).rejects.toMatchObject({
        cause: { message: "relation does not exist" },
      });
      expect(truncate).toHaveBeenCalledTimes(1);
    });

    it("계속 교착이면 무한정 매달리지 않고 마지막 실패를 올린다", async () => {
      const truncate = vi
        .fn<(text: string) => Promise<QueryResult>>()
        .mockRejectedValue(deadlock());
      const testDatabase = await startWith(truncate);

      await expect(testDatabase.cleanup()).rejects.toMatchObject({ cause: { code: "40P01" } });
      expect(truncate).toHaveBeenCalledTimes(3);
    });
  });
});

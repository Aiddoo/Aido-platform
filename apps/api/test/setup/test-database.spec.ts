import type { QueryResult } from "pg";
import { vi } from "vitest";

import { createFakeDatabase, postgresError, queryResult } from "#test/mocks/drizzle.mock";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "./test-database.js";

const MANAGED_ENV = {
  DATABASE_URL: "postgresql://test_user:test_password@localhost:55432/aido_test_abc123",
  AIDO_TEST_DB_MANAGED: "1",
};

type StatementHandler = ReturnType<typeof vi.fn<(text: string) => Promise<QueryResult>>>;

function succeed(): StatementHandler {
  return vi.fn<(text: string) => Promise<QueryResult>>().mockResolvedValue(queryResult());
}

/** 실제 Drizzle 클라이언트에 가짜 pg Pool을 연결해 SQL 종류별 응답을 제어한다. */
function createFakeTestDatabaseClient(
  handlers: {
    probe?: StatementHandler;
    reset?: StatementHandler;
    truncate?: StatementHandler;
  } = {},
) {
  const { database } = createFakeDatabase(async ({ text }) => {
    if (text.includes("session_replication_role")) {
      return (handlers.reset ?? succeed())(text);
    }
    if (text.includes("TRUNCATE")) {
      return (handlers.truncate ?? succeed())(text);
    }
    return (handlers.probe ?? succeed())(text);
  });
  return Object.assign(database, {
    close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  });
}

describe("TestDatabase", () => {
  it("비관리 DATABASE_URL에서 DB 연결을 시도하지 않아야 한다", async () => {
    // Given
    const createTestDatabaseClient = vi.fn();
    const testDatabase = new TestDatabase({
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido_test",
      },
      createClient: createTestDatabaseClient,
    });

    // When
    const start = testDatabase.start();

    // Then
    await expect(start).rejects.toThrow("AIDO_TEST_DB_MANAGED=1");
    expect(createTestDatabaseClient).not.toHaveBeenCalled();
  });

  describe("연결 probe 실패 생명주기", () => {
    it("SELECT 1이 실패하면 client를 닫고 미시작 상태로 돌아가 새 client로 재시도한다", async () => {
      // Given
      const probeError = new Error("synthetic probe failure");
      const firstClient = createFakeTestDatabaseClient({
        probe: vi.fn<(text: string) => Promise<QueryResult>>().mockRejectedValueOnce(probeError),
      });
      const retryClient = createFakeTestDatabaseClient();
      const createClient = vi
        .fn<(uri: string) => TestDatabaseClient>()
        .mockReturnValueOnce(firstClient)
        .mockReturnValueOnce(retryClient);
      const database = new TestDatabase({ env: MANAGED_ENV, createClient });
      try {
        // When
        await expect(database.start()).rejects.toMatchObject({ cause: probeError });
        // Then
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
      // Given
      const probeError = new Error("synthetic original probe failure");
      const failedClient = createFakeTestDatabaseClient({
        probe: vi.fn<(text: string) => Promise<QueryResult>>().mockRejectedValueOnce(probeError),
      });
      failedClient.close.mockRejectedValueOnce(new Error("synthetic close failure"));
      const database = new TestDatabase({ env: MANAGED_ENV, createClient: () => failedClient });
      try {
        // When
        await expect(database.start()).rejects.toMatchObject({ cause: probeError });
        // Then
        expect.soft(failedClient.close).toHaveBeenCalledTimes(1);
        expect.soft(() => database.getClient()).toThrow("TestDatabase not started");
        expect.soft(() => database.getConnectionUri()).toThrow("TestDatabase not started");
      } finally {
        await database.stop().catch(() => undefined);
      }
    });
  });

  describe("테이블 정리", () => {
    async function startWith(handlers: { reset?: StatementHandler; truncate?: StatementHandler }) {
      const testDatabase = new TestDatabase({
        env: MANAGED_ENV,
        createClient: () => createFakeTestDatabaseClient(handlers),
      });
      await testDatabase.start();
      return testDatabase;
    }

    it("FK 트리거를 끈 DELETE 한 문장으로 모든 테이블과 시퀀스를 초기화한다", async () => {
      // Given
      const reset = succeed();
      const truncate = succeed();
      const testDatabase = await startWith({ reset, truncate });

      // When
      await testDatabase.cleanup();

      // Then
      expect(reset).toHaveBeenCalledOnce();
      expect(reset.mock.calls[0]?.[0]).toContain("setval");
      expect(truncate).not.toHaveBeenCalled();
    });

    it("superuser가 아니면 TRUNCATE로 바꾸고 이후에도 TRUNCATE만 쓴다", async () => {
      // Given
      const reset = vi
        .fn<(text: string) => Promise<QueryResult>>()
        .mockRejectedValue(postgresError("42501"));
      const truncate = succeed();
      const testDatabase = await startWith({ reset, truncate });

      // When
      await testDatabase.cleanup();
      await testDatabase.cleanup();

      // Then
      expect(reset).toHaveBeenCalledOnce();
      expect(truncate).toHaveBeenCalledTimes(2);
    });

    it("권한 외 실패는 바꾸지 않고 그대로 올린다", async () => {
      // Given
      const reset = vi
        .fn<(text: string) => Promise<QueryResult>>()
        .mockRejectedValue(new Error("relation does not exist"));
      const truncate = succeed();
      const testDatabase = await startWith({ reset, truncate });

      // When
      const cleanup = testDatabase.cleanup();

      // Then
      await expect(cleanup).rejects.toMatchObject({
        cause: { message: "relation does not exist" },
      });
      expect(truncate).not.toHaveBeenCalled();
    });
  });
});

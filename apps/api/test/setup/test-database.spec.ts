import postgres from "@prisma/orm-postgres/runtime";
import { vi, type Mock } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { TestDatabaseClient } from "#test/setup/test-database";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import { TestDatabase } from "./test-database.js";

const MANAGED_ENV = {
  DATABASE_URL: "postgresql://test_user:test_password@localhost:55432/aido_test_abc123",
  AIDO_TEST_DB_MANAGED: "1",
};

type ExecuteRawMock = Mock<ReturnType<TestDatabaseClient["runtime"]>["execute"]>;

function createFakeTestDatabaseClient(executeRawUnsafe: ExecuteRawMock) {
  const client = mockDeep<TestDatabaseClient>();
  const statics = postgres<Contract>({ contractJson });
  const runtime = mockDeep<ReturnType<TestDatabaseClient["runtime"]>>();
  Object.assign(client, { raw: statics.raw });
  client.close.mockResolvedValue(undefined);
  runtime.query.mockResolvedValue([{ table_name: "Todo" }]);
  runtime.execute.mockImplementation(executeRawUnsafe);
  client.runtime.mockReturnValue(runtime);
  return client;
}

function deadlock() {
  return Object.assign(new Error("deadlock detected"), { kind: "sql_query", sqlState: "40P01" });
}

describe("TestDatabase", () => {
  it("비관리 DATABASE_URL에서 Prisma 연결을 시도하지 않아야 한다", async () => {
    // Given - localhost fallback URL과 Prisma factory spy
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

  // TRUNCATE는 ACCESS EXCLUSIVE 락을 잡는다. 앞 테스트가 남긴 작업과 겹치면 교착으로
  // 튕기는데, 이건 드문 경합이지 설계 결함이 아니다 — 물러섰다 다시 잡는 게 맞다.
  describe("TRUNCATE 교착 재시도", () => {
    async function startWith(executeRawUnsafe: ExecuteRawMock) {
      const testDatabase = new TestDatabase({
        env: MANAGED_ENV,
        createClient: () => createFakeTestDatabaseClient(executeRawUnsafe),
      });
      await testDatabase.start();
      return testDatabase;
    }

    it("교착으로 튕기면 다시 시도해 끝내 정리한다", async () => {
      const executeRawUnsafe = vi
        .fn<ReturnType<TestDatabaseClient["runtime"]>["execute"]>()
        .mockRejectedValueOnce(deadlock())
        .mockResolvedValueOnce({ affectedRows: 1 });
      const testDatabase = await startWith(executeRawUnsafe);

      await expect(testDatabase.cleanup()).resolves.toBeUndefined();
      expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it("교착이 아닌 실패는 즉시 올린다 — 감추면 원인을 잃는다", async () => {
      const executeRawUnsafe = vi
        .fn<ReturnType<TestDatabaseClient["runtime"]>["execute"]>()
        .mockRejectedValue(new Error("relation does not exist"));
      const testDatabase = await startWith(executeRawUnsafe);

      await expect(testDatabase.cleanup()).rejects.toThrow("relation does not exist");
      expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it("계속 교착이면 무한정 매달리지 않고 마지막 실패를 올린다", async () => {
      const executeRawUnsafe = vi
        .fn<ReturnType<TestDatabaseClient["runtime"]>["execute"]>()
        .mockRejectedValue(deadlock());
      const testDatabase = await startWith(executeRawUnsafe);

      await expect(testDatabase.cleanup()).rejects.toThrow("deadlock detected");
      expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
    });
  });
});

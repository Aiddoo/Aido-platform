import { vi } from "vitest";

import {
  assertManagedTestDatabaseEnvironment,
  resolvePnpmCommand,
  startManagedTestDatabase,
} from "./managed-test-database.js";

const { serviceQuery, serviceEnd } = vi.hoisted(() => ({
  serviceQuery: vi.fn(),
  serviceEnd: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    query = serviceQuery;
    end = serviceEnd;
  },
}));

beforeEach(() => {
  serviceQuery.mockReset().mockResolvedValue({ rows: [] });
  serviceEnd.mockReset().mockResolvedValue(undefined);
});

describe("관리형 테스트 DB 수명주기", () => {
  it.each([
    ["win32", "pnpm.cmd"],
    ["darwin", "pnpm"],
    ["linux", "pnpm"],
  ] as const)("%s에서는 migration 실행 파일로 %s을 사용해야 한다", (platform, expected) => {
    expect(resolvePnpmCommand(platform)).toBe(expected);
  });

  it("관리 마커가 없는 DATABASE_URL을 거부해야 한다", () => {
    // Given - 이름만 테스트 DB처럼 보이는 비관리 URL
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido_test_local",
    };

    // When & Then - 명시적인 관리 마커가 없으면 거부
    expect(() => assertManagedTestDatabaseEnvironment(env)).toThrow("AIDO_TEST_DB_MANAGED=1");
  });

  it("허용된 이름이 아닌 DATABASE_URL을 거부해야 한다", () => {
    // Given - 관리 마커는 있지만 개발 DB를 가리키는 URL
    const env = {
      AIDO_TEST_DB_MANAGED: "1",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido",
    };

    // When & Then - aido_test_<run-id> 규칙을 만족하지 않으면 거부
    expect(() => assertManagedTestDatabaseEnvironment(env)).toThrow("aido_test_<run-id>");
  });

  it("migration 실패 시 시작한 컨테이너를 중지해야 한다", async () => {
    // Given - migration이 실패하는 관리형 컨테이너
    const stop = vi.fn().mockResolvedValue(undefined);
    const env: NodeJS.ProcessEnv = {};
    const migrate = vi.fn().mockRejectedValue(new Error("migration failed"));

    // When & Then - 시작 실패를 전파하면서 컨테이너를 정리
    await expect(
      startManagedTestDatabase({
        env,
        createRunId: () => "abc123",
        startDatabase: async () => ({
          getConnectionUri: () => "postgresql://test:test@localhost:5432/aido_test_abc123",
          stop,
        }),
        migrate,
      }),
    ).rejects.toThrow("migration failed");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AIDO_TEST_DB_MANAGED).toBeUndefined();
  });

  it("컨테이너 중지까지 실패해도 원래 migration 오류를 보존해야 한다", async () => {
    // Given - migration과 실패 정리를 위한 컨테이너 중지가 모두 실패
    const migrationError = new Error("migration failed");
    const stopError = new Error("stop failed");
    const stop = vi.fn().mockRejectedValue(stopError);
    const env: NodeJS.ProcessEnv = {};
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      // When & Then - 원래 오류를 전파하고 정리 오류는 진단 가능하게 기록
      await expect(
        startManagedTestDatabase({
          env,
          createRunId: () => "abc123",
          startDatabase: async () => ({
            getConnectionUri: () => "postgresql://test:test@localhost:5432/aido_test_abc123",
            stop,
          }),
          migrate: async () => {
            throw migrationError;
          },
        }),
      ).rejects.toBe(migrationError);
      expect(stop).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to stop managed test database container during cleanup:",
        stopError,
      );
      expect(env.DATABASE_URL).toBeUndefined();
      expect(env.AIDO_TEST_DB_MANAGED).toBeUndefined();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("Vitest 실행당 migration을 한 번만 적용해야 한다", async () => {
    // Given - 정상 시작되는 관리형 컨테이너
    const stop = vi.fn().mockResolvedValue(undefined);
    const migrate = vi.fn().mockResolvedValue(undefined);
    const env: NodeJS.ProcessEnv = {};

    // When - 관리형 테스트 DB 시작
    const handle = await startManagedTestDatabase({
      env,
      createRunId: () => "def456",
      startDatabase: async () => ({
        getConnectionUri: () => "postgresql://test:test@localhost:5432/aido_test_def456",
        stop,
      }),
      migrate,
    });

    // Then - migration은 한 번만 실행되고 teardown에서 컨테이너 종료
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledWith("postgresql://test:test@localhost:5432/aido_test_def456");
    await handle.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("잘못된 생성 이름은 DB 실행 전에 거부해야 한다", async () => {
    // Given
    const startDatabase = vi.fn();
    // When & Then
    await expect(
      startManagedTestDatabase({ createRunId: () => 'unsafe"name', startDatabase }),
    ).rejects.toThrow("invalid generated database name");
    expect(startDatabase).not.toHaveBeenCalled();
  });

  it("명시적인 service URL이 업무 DB를 가리키면 거부해야 한다", async () => {
    // Given
    const env = { AIDO_TEST_POSTGRES_URL: "postgresql://test:test@localhost:5432/aido" };
    // When & Then
    await expect(startManagedTestDatabase({ env })).rejects.toThrow("administration database");
    expect(serviceQuery).not.toHaveBeenCalled();
  });

  it("공식 PostgreSQL service에 실행별 DB를 만들고 자신의 DB만 정리해야 한다", async () => {
    // Given
    const originalDatabaseUrl = "postgresql://unrelated:unrelated@localhost:5432/aido";
    const env = {
      AIDO_TEST_POSTGRES_URL: "postgresql://test:test@localhost:5432/postgres",
      DATABASE_URL: originalDatabaseUrl,
    };
    const migrate = vi.fn().mockResolvedValue(undefined);
    // When
    const handle = await startManagedTestDatabase({
      env,
      createRunId: () => "service123",
      migrate,
    });
    await handle.stop();
    await handle.stop();
    // Then
    expect(migrate).toHaveBeenCalledWith(
      "postgresql://test:test@localhost:5432/aido_test_service123",
    );
    expect(serviceQuery.mock.calls).toEqual([
      ['CREATE DATABASE "aido_test_service123"'],
      [
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        ["aido_test_service123"],
      ],
      ['DROP DATABASE "aido_test_service123"'],
    ]);
    expect(serviceEnd).toHaveBeenCalledTimes(1);
    expect(env.DATABASE_URL).toBe(originalDatabaseUrl);
  });

  it("service DB의 migration 실패도 자신이 만든 DB를 정리하고 원래 환경을 복원해야 한다", async () => {
    // Given
    const env: NodeJS.ProcessEnv = {
      AIDO_TEST_POSTGRES_URL: "postgresql://test:test@localhost:5432/postgres",
    };
    const failure = new Error("migration failed");
    // When & Then
    await expect(
      startManagedTestDatabase({
        env,
        createRunId: () => "failed123",
        migrate: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(serviceQuery).toHaveBeenLastCalledWith('DROP DATABASE "aido_test_failed123"');
    expect(serviceEnd).toHaveBeenCalledTimes(1);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AIDO_TEST_DB_MANAGED).toBeUndefined();
  });

  it("service DB 생성 실패 시 pool을 닫고 migration을 실행하지 않아야 한다", async () => {
    // Given
    const failure = new Error("create failed");
    serviceQuery.mockRejectedValueOnce(failure);
    const migrate = vi.fn();
    // When & Then
    await expect(
      startManagedTestDatabase({
        env: { AIDO_TEST_POSTGRES_URL: "postgresql://test:test@localhost:5432/postgres" },
        migrate,
      }),
    ).rejects.toBe(failure);
    expect(serviceEnd).toHaveBeenCalledTimes(1);
    expect(migrate).not.toHaveBeenCalled();
  });
});

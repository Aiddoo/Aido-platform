import { and } from "@prisma/orm-postgres/orm-client";
/**
 * LoginAttemptRepository 단위 테스트
 *
 * @description
 * 로그인 시도 저장소의 기록, 실패 카운트, 조회 메서드를 검증한다.
 * 이메일/IP 기준 실패 횟수 카운트, 만료 삭제를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test login-attempt.repository.spec.ts
 * ```
 */
import { vi } from "vitest";

import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { LoginAttemptBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";
import { asTxClient, createMockTxClient } from "#test/mocks/transaction.mock";

import { LoginAttemptRepository } from "./login-attempt.repository.js";

describe("LoginAttemptRepository — 로그인 시도 리포지토리", () => {
  let repository: LoginAttemptRepository;
  let db: ReturnType<typeof createMockDatabaseService>;

  const mockSuccessfulAttempt = LoginAttemptBuilder.create("user@example.com")
    .withId(1)
    .withIpAddress("192.168.1.1")
    .withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    .withCreatedAt(new Date("2025-01-15T10:00:00Z"))
    .build();

  const mockFailedAttempt = LoginAttemptBuilder.create("user@example.com")
    .withId(2)
    .withIpAddress("192.168.1.1")
    .withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    .failed("INVALID_PASSWORD")
    .withCreatedAt(new Date("2025-01-15T09:00:00Z"))
    .build();

  beforeEach(async () => {
    db = createMockDatabaseService();
    repository = new LoginAttemptRepository(db);
  });

  describe("create", () => {
    it("성공한 로그인 시도를 기록한다", async () => {
      // Given
      const createData = {
        email: "user@example.com",
        provider: "CREDENTIAL" as const,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        success: true,
      };
      vi.mocked(db.db.orm.public.LoginAttempt.create).mockResolvedValue(
        databaseFixture("LoginAttempt", mockSuccessfulAttempt),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockSuccessfulAttempt);
      expect(db.db.orm.public.LoginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("LoginAttempt", {
            email: createData.email,
            provider: createData.provider,
            ipAddress: createData.ipAddress,
            userAgent: createData.userAgent,
            success: createData.success,
            failureReason: undefined,
          }),
        ),
      );
    });

    it("실패한 로그인 시도를 기록한다", async () => {
      // Given
      const createData = {
        email: "user@example.com",
        provider: "CREDENTIAL" as const,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        success: false,
        failureReason: "INVALID_PASSWORD",
      };
      vi.mocked(db.db.orm.public.LoginAttempt.create).mockResolvedValue(
        databaseFixture("LoginAttempt", mockFailedAttempt),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockFailedAttempt);
      expect(db.db.orm.public.LoginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("LoginAttempt", {
            email: createData.email,
            provider: createData.provider,
            ipAddress: createData.ipAddress,
            userAgent: createData.userAgent,
            success: createData.success,
            failureReason: createData.failureReason,
          }),
        ),
      );
    });

    it("트랜잭션 클라이언트를 사용하여 기록한다", async () => {
      // Given
      const mockTx = createMockTxClient();
      mockTx.orm.public.LoginAttempt.create.mockResolvedValue(
        databaseFixture("LoginAttempt", mockSuccessfulAttempt),
      );
      const createData = {
        email: "user@example.com",
        provider: "CREDENTIAL" as const,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      };

      // When
      const result = await repository.create(createData, asTxClient(mockTx));

      // Then
      expect(result).toEqual(mockSuccessfulAttempt);
      expect(mockTx.orm.public.LoginAttempt.create).toHaveBeenCalled();
      expect(db.db.orm.public.LoginAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe("countRecentFailuresByEmail", () => {
    const since = new Date("2025-01-15T00:00:00Z");

    it("이메일 기준 최근 실패 횟수를 카운트한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.aggregate).mockResolvedValue({ count: 3 });

      // When
      const result = await repository.countRecentFailuresByEmail("user@example.com", since);

      // Then
      expect(result).toBe(3);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.email.eq(varchar("user@example.com", 255)),
            row.success.eq(false),
            row.createdAt.gte(databaseTimestamp(since)),
          ),
      );
    });

    it("실패 기록이 없으면 0을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.aggregate).mockResolvedValue({ count: 0 });

      // When
      const result = await repository.countRecentFailuresByEmail("clean@example.com", since);

      // Then
      expect(result).toBe(0);
    });
  });

  describe("countRecentFailuresByIp", () => {
    const since = new Date("2025-01-15T00:00:00Z");

    it("IP 기준 최근 실패 횟수를 카운트한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.aggregate).mockResolvedValue({ count: 5 });

      // When
      const result = await repository.countRecentFailuresByIp("192.168.1.1", since);

      // Then
      expect(result).toBe(5);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.ipAddress.eq(varchar("192.168.1.1", 45)),
            row.success.eq(false),
            row.createdAt.gte(databaseTimestamp(since)),
          ),
      );
    });

    it("실패 기록이 없으면 0을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.aggregate).mockResolvedValue({ count: 0 });

      // When
      const result = await repository.countRecentFailuresByIp("10.0.0.1", since);

      // Then
      expect(result).toBe(0);
    });
  });

  describe("findLastSuccessByEmail", () => {
    it("이메일의 마지막 성공 기록을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.first).mockResolvedValue(
        databaseFixture("LoginAttempt", mockSuccessfulAttempt),
      );

      // When
      const result = await repository.findLastSuccessByEmail("user@example.com");

      // Then
      expect(result).toEqual(mockSuccessfulAttempt);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls[0]?.[0],
        (row) => and(row.email.eq(varchar("user@example.com", 255)), row.success.eq(true)),
      );
    });

    it("성공 기록이 없으면 null을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.first).mockResolvedValue(
        databaseFixture("LoginAttempt", null),
      );

      // When
      const result = await repository.findLastSuccessByEmail("new@example.com");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("findLastFailureByEmail", () => {
    it("이메일의 마지막 실패 기록을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.first).mockResolvedValue(
        databaseFixture("LoginAttempt", mockFailedAttempt),
      );

      // When
      const result = await repository.findLastFailureByEmail("user@example.com");

      // Then
      expect(result).toEqual(mockFailedAttempt);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls[0]?.[0],
        (row) => and(row.email.eq(varchar("user@example.com", 255)), row.success.eq(false)),
      );
    });

    it("실패 기록이 없으면 null을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.first).mockResolvedValue(
        databaseFixture("LoginAttempt", null),
      );

      // When
      const result = await repository.findLastFailureByEmail("clean@example.com");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("clearRecentFailuresByEmail", () => {
    it("감사 로그 목적으로 실제 삭제하지 않는다", async () => {
      // Given
      const since = new Date("2025-01-15T00:00:00Z");

      // When
      await repository.clearRecentFailuresByEmail("user@example.com", since);

      // Then
      // 메서드가 no-op이므로 DB 호출이 없어야 함
      expect(db.db.orm.public.LoginAttempt.deleteAndCount).not.toHaveBeenCalled();
    });
  });

  describe("deleteOld", () => {
    it("기본 30일 이전 기록을 삭제한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.deleteAndCount).mockResolvedValue(100);

      // When
      const result = await repository.deleteOld();

      // Then
      expect(result).toBe(100);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls.at(-1)?.[0],
        (row) => row.createdAt.lt(expect.any(String)),
      );
    });

    it("지정된 보관 기간으로 삭제한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.deleteAndCount).mockResolvedValue(50);

      // When
      const result = await repository.deleteOld(7);

      // Then
      expect(result).toBe(50);
      assertNativeWhere(
        "LoginAttempt",
        db.db.orm.public.LoginAttempt.where.mock.calls.at(-1)?.[0],
        (row) => row.createdAt.lt(expect.any(String)),
      );
    });

    it("삭제할 기록이 없으면 0을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.LoginAttempt.deleteAndCount).mockResolvedValue(0);

      // When
      const result = await repository.deleteOld();

      // Then
      expect(result).toBe(0);
    });
  });
});

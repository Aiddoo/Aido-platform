import { and } from "@prisma/orm-postgres/orm-client";

import { databaseTimestamp, varchar } from "#api/shared/infrastructure/database/database-values";
import type {
  SecurityEvent,
  SecurityLog,
} from "#api/shared/infrastructure/database/database.types";
/**
 * SecurityLogRepository 단위 테스트
 *
 * @description
 * 보안 로그 저장소의 CRUD 및 집계 메서드를 검증한다.
 * 트랜잭션 클라이언트 지원, 이벤트별 카운트, 만료 삭제를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test security-log.repository.spec.ts
 * ```
 */
import { SecurityLogBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { SecurityLogRepository } from "./security-log.repository.js";

/**
 * groupBy 결과 타입 (Prisma groupBy 결과의 부분 타입)
 */
interface SecurityLogGroupByResult {
  event: SecurityEvent;
  _count: {
    event: number;
  };
}

describe("SecurityLogRepository — 보안 로그 리포지토리", () => {
  let repository: SecurityLogRepository;
  let db: MockDatabaseContext;

  const mockSecurityLog = SecurityLogBuilder.create("user-123", "LOGIN_SUCCESS")
    .withId(1)
    .withIpAddress("192.168.1.1")
    .withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    .withMetadata({ browser: "Chrome", os: "macOS" })
    .withCreatedAt(new Date("2025-01-15T10:00:00Z"))
    .build();

  beforeEach(async () => {
    // Given - Suites가 모든 의존성을 자동으로 mock
    db = createMockDatabaseContext();

    repository = new SecurityLogRepository(createMockTransactionHost(db));
  });

  describe("create", () => {
    const createData = {
      userId: "user-123",
      event: "LOGIN_SUCCESS" as const,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      metadata: { browser: "Chrome", os: "macOS" },
    };

    it("보안 로그를 생성한다", async () => {
      // Given
      db.orm.public.SecurityLog.create.mockResolvedValue(
        databaseFixture("SecurityLog", mockSecurityLog),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockSecurityLog);
      expect(db.orm.public.SecurityLog.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("SecurityLog", {
            userId: createData.userId,
            event: createData.event,
            ipAddress: createData.ipAddress,
            userAgent: createData.userAgent,
            metadata: createData.metadata,
          }),
        ),
      );
    });

    it("userId 없이 보안 로그를 생성한다", async () => {
      // Given
      const anonymousLogData = {
        event: "LOGIN_FAILURE" as const,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };
      const anonymousLog: SecurityLog = {
        ...mockSecurityLog,
        userId: null,
        event: "LOGIN_FAILURE",
        metadata: null,
      };
      db.orm.public.SecurityLog.create.mockResolvedValue(
        databaseFixture("SecurityLog", anonymousLog),
      );

      // When
      const result = await repository.create(anonymousLogData);

      // Then
      expect(result).toEqual(anonymousLog);
      expect(db.orm.public.SecurityLog.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("SecurityLog", {
            userId: undefined,
            event: anonymousLogData.event,
            ipAddress: anonymousLogData.ipAddress,
            userAgent: anonymousLogData.userAgent,
            metadata: undefined,
          }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 생성한다", async () => {
      // Given
      db.orm.public.SecurityLog.create.mockResolvedValue(
        databaseFixture("SecurityLog", mockSecurityLog),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockSecurityLog);
      expect(db.orm.public.SecurityLog.create).toHaveBeenCalled();
    });
  });

  describe("findByUserId", () => {
    const securityLogs: SecurityLog[] = [
      mockSecurityLog,
      {
        ...mockSecurityLog,
        id: 2,
        event: "PASSWORD_CHANGED",
        createdAt: new Date("2025-01-14T10:00:00Z"),
      },
    ];

    it("사용자의 보안 로그를 최신순으로 조회한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", securityLogs)),
      );

      // When
      const result = await repository.findByUserId("user-123");

      // Then
      expect(result).toEqual(securityLogs);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => row.userId.eq("user-123"),
      );
    });

    it("limit 옵션을 적용하여 조회한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", [mockSecurityLog])),
      );

      // When
      const result = await repository.findByUserId("user-123", { limit: 10 });

      // Then
      expect(result).toHaveLength(1);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => row.userId.eq("user-123"),
      );
    });

    it("특정 이벤트 타입만 필터링하여 조회한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", [mockSecurityLog])),
      );

      // When
      const result = await repository.findByUserId("user-123", {
        events: ["LOGIN_SUCCESS", "LOGIN_FAILURE"],
      });

      // Then
      expect(result).toHaveLength(1);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => and(row.userId.eq("user-123"), row.event.in(["LOGIN_SUCCESS", "LOGIN_FAILURE"])),
      );
    });
  });

  describe("findRecentByEvent", () => {
    const since = new Date("2025-01-01T00:00:00Z");

    it("특정 이벤트 타입의 최근 로그를 조회한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", [mockSecurityLog])),
      );

      // When
      const result = await repository.findRecentByEvent("LOGIN_SUCCESS", since);

      // Then
      expect(result).toHaveLength(1);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => and(row.event.eq("LOGIN_SUCCESS"), row.createdAt.gte(databaseTimestamp(since))),
      );
    });

    it("userId 옵션으로 필터링한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", [mockSecurityLog])),
      );

      // When
      const result = await repository.findRecentByEvent("LOGIN_SUCCESS", since, {
        userId: "user-123",
      });

      // Then
      expect(result).toHaveLength(1);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.event.eq("LOGIN_SUCCESS"),
            row.createdAt.gte(databaseTimestamp(since)),
            row.userId.eq("user-123"),
          ),
      );
    });

    it("ipAddress 옵션으로 필터링한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", [mockSecurityLog])),
      );

      // When
      const result = await repository.findRecentByEvent("LOGIN_FAILURE", since, {
        ipAddress: "192.168.1.1",
      });

      // Then
      expect(result).toHaveLength(1);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.event.eq("LOGIN_FAILURE"),
            row.createdAt.gte(databaseTimestamp(since)),
            row.ipAddress.eq(varchar("192.168.1.1", 45)),
          ),
      );
    });

    it("limit 옵션을 적용한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(nativeRows(databaseFixture("SecurityLog", [])));

      // When
      await repository.findRecentByEvent("LOGIN_SUCCESS", since, { limit: 10 });

      // Then
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => and(row.event.eq("LOGIN_SUCCESS"), row.createdAt.gte(databaseTimestamp(since))),
      );
    });
  });

  describe("findSuspiciousActivityByIp", () => {
    const since = new Date("2025-01-01T00:00:00Z");
    const suspiciousLogs: SecurityLog[] = [
      { ...mockSecurityLog, event: "LOGIN_FAILURE" },
      { ...mockSecurityLog, id: 2, event: "SUSPICIOUS_ACTIVITY" },
    ];

    it("IP 주소의 의심스러운 활동을 조회한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(
        nativeRows(databaseFixture("SecurityLog", suspiciousLogs)),
      );

      // When
      const result = await repository.findSuspiciousActivityByIp("192.168.1.1", since);

      // Then
      expect(result).toEqual(suspiciousLogs);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.ipAddress.eq(varchar("192.168.1.1", 45)),
            row.createdAt.gte(databaseTimestamp(since)),
            row.event.in([
              "LOGIN_FAILURE",
              "SUSPICIOUS_ACTIVITY",
              "TOKEN_REVOKED",
              "SESSION_REVOKED_ALL",
            ]),
          ),
      );
    });

    it("의심스러운 활동이 없으면 빈 배열을 반환한다", async () => {
      // Given
      db.orm.public.SecurityLog.all.mockReturnValue(nativeRows(databaseFixture("SecurityLog", [])));

      // When
      const result = await repository.findSuspiciousActivityByIp("10.0.0.1", since);

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("deleteOld", () => {
    it("기본 90일 이전 로그를 삭제한다", async () => {
      // Given
      db.orm.public.SecurityLog.deleteAndCount.mockResolvedValue(100);

      // When
      const result = await repository.deleteOld();

      // Then
      expect(result).toBe(100);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => row.createdAt.lt(expect.any(String)),
      );
    });

    it("지정된 보관 기간으로 삭제한다", async () => {
      // Given
      db.orm.public.SecurityLog.deleteAndCount.mockResolvedValue(50);

      // When
      const result = await repository.deleteOld(30);

      // Then
      expect(result).toBe(50);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => row.createdAt.lt(expect.any(String)),
      );
    });

    it("삭제할 로그가 없으면 0을 반환한다", async () => {
      // Given
      db.orm.public.SecurityLog.deleteAndCount.mockResolvedValue(0);

      // When
      const result = await repository.deleteOld();

      // Then
      expect(result).toBe(0);
    });
  });

  describe("countByEvent", () => {
    const since = new Date("2025-01-01T00:00:00Z");
    const until = new Date("2025-01-31T23:59:59Z");

    it("기간 내 이벤트별 카운트를 반환한다", async () => {
      // Given
      const groupByResult: SecurityLogGroupByResult[] = [
        { event: "LOGIN_SUCCESS", _count: { event: 100 } },
        { event: "LOGIN_FAILURE", _count: { event: 20 } },
        { event: "PASSWORD_CHANGED", _count: { event: 5 } },
      ];
      asMock(db.orm.public.SecurityLog.groupBy("event").aggregate).mockResolvedValue(
        groupByResult.map((value) => ({ event: value.event, count: value._count.event })),
      );

      // When
      const result = await repository.countByEvent(since, until);

      // Then
      expect(result).toEqual([
        { event: "LOGIN_SUCCESS", count: 100 },
        { event: "LOGIN_FAILURE", count: 20 },
        { event: "PASSWORD_CHANGED", count: 5 },
      ]);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.createdAt.gte(databaseTimestamp(since)),
            row.createdAt.lte(databaseTimestamp(until)),
          ),
      );
    });

    it("until 없이 since부터 현재까지 카운트한다", async () => {
      // Given
      const groupByResult: SecurityLogGroupByResult[] = [
        { event: "LOGIN_SUCCESS", _count: { event: 50 } },
      ];
      asMock(db.orm.public.SecurityLog.groupBy("event").aggregate).mockResolvedValue(
        groupByResult.map((value) => ({ event: value.event, count: value._count.event })),
      );

      // When
      const result = await repository.countByEvent(since);

      // Then
      expect(result).toEqual([{ event: "LOGIN_SUCCESS", count: 50 }]);
      assertNativeWhere(
        "SecurityLog",
        db.orm.public.SecurityLog.where.mock.calls.at(-1)?.[0],
        (row) => row.createdAt.gte(databaseTimestamp(since)),
      );
    });

    it("이벤트가 없으면 빈 배열을 반환한다", async () => {
      // Given
      asMock(db.orm.public.SecurityLog.groupBy("event").aggregate).mockResolvedValue([]);

      // When
      const result = await repository.countByEvent(since);

      // Then
      expect(result).toEqual([]);
    });
  });
});

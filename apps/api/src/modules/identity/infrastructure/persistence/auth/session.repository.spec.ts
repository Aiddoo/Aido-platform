import { and, or } from "@prisma/orm-postgres/orm-client";

import { varchar } from "#api/platform/database/database-values";
import { SessionBuilder } from "#test/builders/index";
/**
 * SessionRepository 단위 테스트
 *
 * @description
 * 세션 저장소의 CRUD, 토큰 로테이션, 폐기 메서드를 검증한다.
 * 트랜잭션 지원, 버전 기반 낙관적 잠금, 만료 삭제를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test session.repository.spec.ts
 * ```
 */
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { SessionRepository } from "./session.repository.js";

describe("SessionRepository — 세션 리포지토리", () => {
  let repository: SessionRepository;
  let db: MockDatabaseContext;

  // Builder로 기본 테스트 세션 생성
  const mockSession = SessionBuilder.create("user-123")
    .withId("session-123")
    .withRefreshTokenHash("hashed-refresh-token")
    .withTokenFamily("family-123")
    .withTokenVersion(1)
    .withDeviceInfo("Mozilla/5.0", "127.0.0.1")
    .withExpiresAt(new Date("2024-12-31"))
    .build();

  beforeEach(async () => {
    // Given - Suites가 모든 의존성을 자동으로 mock
    db = createMockDatabaseContext();

    repository = new SessionRepository(createMockTransactionHost(db));
  });

  describe("create", () => {
    it("새 세션을 생성한다", async () => {
      // Given - 세션 생성 데이터 준비
      const createData = {
        userId: "user-123",
        refreshTokenHash: "hashed-token",
        tokenFamily: "family-123",
        tokenVersion: 1,
        deviceFingerprint: "device-fp",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
        expiresAt: new Date("2024-12-31"),
      };
      db.orm.public.Session.create.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - 세션 생성 실행
      const result = await repository.create(createData);

      // Then - 생성된 세션 검증
      expect(result).toEqual(mockSession);
      expect(db.orm.public.Session.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            userId: createData.userId,
            tokenFamily: createData.tokenFamily,
            tokenVersion: createData.tokenVersion,
            ipAddress: createData.ipAddress,
          }),
        ),
      );
    });

    it("refreshTokenHash가 없으면 임시 해시를 생성한다", async () => {
      // Given - refreshTokenHash 없이 세션 생성 데이터 준비
      const createData = {
        userId: "user-123",
        tokenFamily: "family-123",
        tokenVersion: 1,
        deviceFingerprint: "device-fp",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
        expiresAt: new Date("2024-12-31"),
      };
      db.orm.public.Session.create.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - 세션 생성 실행
      await repository.create(createData);

      // Then - 임시 해시가 생성되었는지 검증
      expect(db.orm.public.Session.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            refreshTokenHash: expect.stringContaining("pending_"),
          }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 세션을 생성한다", async () => {
      // Given - 세션 생성 데이터 준비
      const createData = {
        userId: "user-123",
        tokenFamily: "family-123",
        tokenVersion: 1,
        deviceFingerprint: "device-fp",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
        expiresAt: new Date("2024-12-31"),
      };
      db.orm.public.Session.create.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - 활성 트랜잭션 클라이언트로 세션 생성 실행
      await repository.create(createData);

      // Then - 활성 트랜잭션 클라이언트를 통해 생성되었는지 검증
      expect(db.orm.public.Session.create).toHaveBeenCalled();
    });
  });

  describe("updateRefreshTokenHash", () => {
    it("리프레시 토큰 해시를 업데이트한다", async () => {
      // Given - 새로운 해시값 준비
      const newHash = "new-hashed-token";
      const updatedSession = SessionBuilder.create("user-123")
        .withId("session-123")
        .withRefreshTokenHash(newHash)
        .build();
      db.orm.public.Session.update.mockResolvedValue(databaseFixture("Session", updatedSession));

      // When - 리프레시 토큰 해시 업데이트 실행
      const result = await repository.updateRefreshTokenHash("session-123", newHash);

      // Then - 업데이트된 해시값 검증
      expect(result.refreshTokenHash).toBe(newHash);
      expect(db.orm.public.Session.update).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("Session", { refreshTokenHash: newHash })),
      );
    });
  });

  describe("findById", () => {
    it("ID로 세션을 찾아 반환한다", async () => {
      // Given - 세션 조회 Mock 설정
      db.orm.public.Session.first.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - ID로 세션 조회 실행
      const result = await repository.findById("session-123");

      // Then - 조회된 세션 검증
      expect(result).toEqual(mockSession);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls[0]?.[0], (row) =>
        row.id.eq("session-123"),
      );
    });

    it("세션이 없으면 null을 반환한다", async () => {
      // Given - 존재하지 않는 세션 Mock 설정
      db.orm.public.Session.first.mockResolvedValue(databaseFixture("Session", null));

      // When - 존재하지 않는 세션 조회 실행
      const result = await repository.findById("nonexistent");

      // Then - null 반환 검증
      expect(result).toBeNull();
    });
  });

  describe("findByRefreshTokenHash", () => {
    it("리프레시 토큰 해시로 세션을 찾는다", async () => {
      // Given - 세션 조회 Mock 설정
      db.orm.public.Session.first.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - 리프레시 토큰 해시로 세션 조회 실행
      const result = await repository.findByRefreshTokenHash("hashed-token");

      // Then - 조회된 세션 검증
      expect(result).toEqual(mockSession);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls[0]?.[0], (row) =>
        row.refreshTokenHash.eq(varchar("hashed-token", 64)),
      );
    });
  });

  describe("findByTokenFamily", () => {
    it("토큰 패밀리로 활성 세션을 찾는다", async () => {
      // Given - 활성 세션 조회 Mock 설정
      db.orm.public.Session.first.mockResolvedValue(databaseFixture("Session", mockSession));

      // When - 토큰 패밀리로 세션 조회 실행
      const result = await repository.findByTokenFamily("family-123");

      // Then - 조회된 활성 세션 검증
      expect(result).toEqual(mockSession);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls[0]?.[0], (row) =>
        and(row.tokenFamily.eq(varchar("family-123", 36)), row.revokedAt.isNull()),
      );
    });
  });

  describe("findActiveByUserId", () => {
    it("사용자의 활성 세션 목록을 반환한다", async () => {
      // Given - 여러 활성 세션 Mock 설정
      const session2 = SessionBuilder.create("user-123").withId("session-2").build();
      const activeSessions = [mockSession, session2];
      db.orm.public.Session.all.mockReturnValue(
        nativeRows(databaseFixture("Session", activeSessions)),
      );

      // When - 사용자 ID로 활성 세션 목록 조회 실행
      const result = await repository.findActiveByUserId("user-123");

      // Then - 활성 세션 목록 검증
      expect(result).toHaveLength(2);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls.at(-1)?.[0], (row) =>
        and(
          row.userId.eq("user-123"),
          row.revokedAt.isNull(),
          row.expiresAt.gt(expect.any(String)),
        ),
      );
    });

    it("활성 세션이 없으면 빈 배열을 반환한다", async () => {
      // Given - 빈 세션 목록 Mock 설정
      db.orm.public.Session.all.mockReturnValue(nativeRows(databaseFixture("Session", [])));

      // When - 활성 세션이 없는 사용자 조회 실행
      const result = await repository.findActiveByUserId("user-123");

      // Then - 빈 배열 반환 검증
      expect(result).toEqual([]);
    });
  });

  describe("rotateToken", () => {
    it("토큰 로테이션을 수행한다", async () => {
      // Given - 토큰 로테이션 데이터 준비
      const rotatedSession = SessionBuilder.create("user-123")
        .withId("session-123")
        .withRefreshTokenHash("new-hash")
        .withTokenVersion(2)
        .withPreviousTokenHash("old-hash")
        .build();
      db.orm.public.Session.update.mockResolvedValue(databaseFixture("Session", rotatedSession));

      // When - 토큰 로테이션 실행
      const result = await repository.rotateToken("session-123", {
        refreshTokenHash: "new-hash",
        tokenVersion: 2,
        previousTokenHash: "old-hash",
        expectedTokenVersion: 1,
        expiresAt: new Date("2025-01-15"),
      });

      // Then - 로테이션된 세션 검증
      expect(result).toEqual(rotatedSession);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls[0]?.[0], (row) =>
        and(row.id.eq("session-123"), row.tokenVersion.eq(1), row.revokedAt.isNull()),
      );
      expect(db.orm.public.Session.first).not.toHaveBeenCalled();
      expect(db.orm.public.Session.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            refreshTokenHash: "new-hash",
            tokenVersion: 2,
            previousTokenHash: "old-hash",
            expiresAt: new Date("2025-01-15"),
            lastUsedAt: expect.any(String),
          }),
        ),
      );
    });

    it("rotateToken 호출 시 expiresAt도 함께 업데이트한다", async () => {
      // Given
      const sessionId = "session-123";
      const rotateData = {
        refreshTokenHash: "new-hash",
        tokenVersion: 2,
        previousTokenHash: "old-hash",
        expectedTokenVersion: 1,
        expiresAt: new Date("2025-01-15"),
      };

      db.orm.public.Session.update.mockResolvedValue(databaseFixture("Session", mockSession));

      // When
      await repository.rotateToken(sessionId, rotateData);

      // Then
      expect(db.orm.public.Session.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            expiresAt: rotateData.expiresAt,
          }),
        ),
      );
    });

    it("버전 불일치 시 null을 반환한다", async () => {
      // Given - 버전 불일치 상황 Mock 설정 (업데이트 count: 0)
      db.orm.public.Session.update.mockResolvedValue(null);

      // When - 버전 불일치 상태로 토큰 로테이션 실행
      const result = await repository.rotateToken("session-123", {
        refreshTokenHash: "new-hash",
        tokenVersion: 3,
        previousTokenHash: "old-hash",
        expectedTokenVersion: 2, // 실제 버전과 불일치
        expiresAt: new Date("2025-01-15"),
      });

      // Then - null 반환 검증
      expect(result).toBeNull();
    });
  });

  describe("updateLastUsedAt", () => {
    it("마지막 사용 시간을 업데이트한다", async () => {
      // Given - 업데이트 Mock 설정
      const updatedSession = SessionBuilder.create("user-123")
        .withId("session-123")
        .withLastUsedAt(new Date())
        .build();
      db.orm.public.Session.update.mockResolvedValue(databaseFixture("Session", updatedSession));

      // When - 마지막 사용 시간 업데이트 실행
      await repository.updateLastUsedAt("session-123");

      // Then - 업데이트 호출 검증
      expect(db.orm.public.Session.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", { lastUsedAt: expect.any(String) }),
        ),
      );
    });
  });

  describe("revoke", () => {
    it("세션을 폐기한다", async () => {
      // Given - 폐기된 세션 Mock 설정
      const revokedSession = SessionBuilder.create("user-123")
        .withId("session-123")
        .revoked("user_logout")
        .build();
      db.orm.public.Session.update.mockResolvedValue(databaseFixture("Session", revokedSession));

      // When - 세션 폐기 실행
      const result = await repository.revoke("session-123", "user_logout");

      // Then - 폐기된 세션 검증
      expect(result.revokedAt).toBeDefined();
      expect(result.revokedReason).toBe("user_logout");
      expect(db.orm.public.Session.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            revokedAt: expect.any(String),
            revokedReason: "user_logout",
          }),
        ),
      );
    });
  });

  describe("revokeByTokenFamily", () => {
    it("토큰 패밀리 전체를 폐기한다", async () => {
      // Given - 여러 세션 폐기 Mock 설정
      db.orm.public.Session.updateAndCount.mockResolvedValue(3);

      // When - 토큰 패밀리 전체 폐기 실행
      const result = await repository.revokeByTokenFamily("family-123", "token_reuse_detected");

      // Then - 폐기된 세션 수 검증
      expect(result).toBe(3);
      expect(db.orm.public.Session.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            revokedAt: expect.any(String),
            revokedReason: "token_reuse_detected",
          }),
        ),
      );
    });
  });

  describe("revokeAllByUserId", () => {
    it("사용자의 모든 세션을 폐기한다", async () => {
      // Given - 사용자의 모든 세션 폐기 Mock 설정
      db.orm.public.Session.updateAndCount.mockResolvedValue(5);

      // When - 사용자의 모든 세션 폐기 실행
      const result = await repository.revokeAllByUserId("user-123", "password_changed");

      // Then - 폐기된 세션 수 검증
      expect(result).toBe(5);
      expect(db.orm.public.Session.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            revokedAt: expect.any(String),
            revokedReason: "password_changed",
          }),
        ),
      );
    });

    it("특정 세션을 제외하고 폐기한다", async () => {
      // Given - 특정 세션 제외 폐기 Mock 설정
      db.orm.public.Session.updateAndCount.mockResolvedValue(4);

      // When - 현재 세션을 제외하고 나머지 폐기 실행
      const result = await repository.revokeAllByUserId(
        "user-123",
        "logout_all",
        "current-session-id",
      );

      // Then - 제외된 세션을 제외한 폐기 검증
      expect(result).toBe(4);
      expect(db.orm.public.Session.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Session", {
            revokedAt: expect.any(String),
            revokedReason: "logout_all",
          }),
        ),
      );
    });
  });

  describe("deleteExpired", () => {
    it("만료되거나 폐기된 세션을 삭제한다", async () => {
      // Given - 만료/폐기된 세션 삭제 Mock 설정
      db.orm.public.Session.deleteAndCount.mockResolvedValue(10);

      // When - 만료된 세션 삭제 실행
      const result = await repository.deleteExpired();

      // Then - 삭제된 세션 수 검증
      expect(result).toBe(10);
      assertNativeWhere("Session", db.orm.public.Session.where.mock.calls.at(-1)?.[0], (row) =>
        or(row.expiresAt.lt(expect.any(String)), row.revokedAt.isNotNull()),
      );
    });
  });
});

import { and, or } from "@prisma/orm-postgres/orm-client";

import { databaseTimestamp, varchar } from "#api/shared/infrastructure/database/database-values";
import { type Verification } from "#api/shared/infrastructure/database/database.types";
import { VerificationBuilder } from "#test/builders/index";
/**
 * VerificationRepository 단위 테스트
 *
 * @description
 * 인증 토큰 저장소의 CRUD, 원자적 사용 처리, 무효화 메서드를 검증한다.
 * 트랜잭션 지원, 시도 횟수 관리, 만료 삭제를 확인한다.
 *
 * 이 저장소는 두 개의 클라이언트를 사용한다.
 * - `txHost.tx`(활성 트랜잭션): 대부분의 메서드
 * - `database`(베이스 클라이언트): `incrementAttempts`, `deleteExpired`
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test verification.repository.spec.ts
 * ```
 */
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { VerificationRepository } from "./verification.repository.js";

describe("VerificationRepository — 인증 코드 리포지토리", () => {
  let repository: VerificationRepository;
  let db: MockDatabaseContext;
  let baseDb: MockDatabaseContext;

  const mockVerification = VerificationBuilder.create("user-123", "EMAIL_VERIFY")
    .withId(1)
    .withToken("hashed-token-123")
    .withExpiresAt(new Date("2025-12-31T23:59:59Z"))
    .withCreatedAt(new Date("2025-01-01T00:00:00Z"))
    .build();

  beforeEach(async () => {
    db = createMockDatabaseContext();
    baseDb = createMockDatabaseContext();

    repository = new VerificationRepository(
      createMockTransactionHost(db),
      createMockDatabaseService(baseDb),
    );
  });

  describe("create", () => {
    const createData: Parameters<VerificationRepository["create"]>[0] = {
      userId: "user-123",
      type: "EMAIL_VERIFY",
      token: "hashed-token-123",
      expiresAt: new Date("2025-12-31T23:59:59Z"),
    };

    it("새 인증 토큰을 생성한다", async () => {
      // Given
      db.orm.public.Verification.create.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockVerification);
      expect(db.orm.public.Verification.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", {
            userId: createData.userId,
            type: createData.type,
            token: createData.token,
            expiresAt: createData.expiresAt,
          }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 생성한다", async () => {
      // Given
      db.orm.public.Verification.create.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.create(createData);

      // Then
      expect(result).toEqual(mockVerification);
      expect(db.orm.public.Verification.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", {
            userId: createData.userId,
            type: createData.type,
            token: createData.token,
            expiresAt: createData.expiresAt,
          }),
        ),
      );
    });
  });

  describe("findByToken", () => {
    it("토큰 해시로 인증을 찾는다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.findByToken("hashed-token-123");

      // Then
      expect(result).toEqual(mockVerification);
      assertNativeWhere(
        "Verification",
        db.orm.public.Verification.where.mock.calls[0]?.[0],
        (row) => row.token.eq(varchar("hashed-token-123", 64)),
      );
    });

    it("존재하지 않으면 null을 반환한다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(databaseFixture("Verification", null));

      // When
      const result = await repository.findByToken("non-existent-token");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("findLatestByUserIdAndType", () => {
    it("사용자의 최신 유효 인증 토큰을 찾는다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.findLatestByUserIdAndType("user-123", "EMAIL_VERIFY");

      // Then
      expect(result).toEqual(mockVerification);
      assertNativeWhere(
        "Verification",
        db.orm.public.Verification.where.mock.calls[0]?.[0],
        (row) =>
          and(
            row.userId.eq("user-123"),
            row._type.eq("EMAIL_VERIFY"),
            row.usedAt.isNull(),
            row.expiresAt.gt(expect.any(String)),
          ),
      );
    });

    it("유효한 인증이 없으면 null을 반환한다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(databaseFixture("Verification", null));

      // When
      const result = await repository.findLatestByUserIdAndType("user-123", "PASSWORD_RESET");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("findValidByUserIdAndType", () => {
    it("사용자의 유효한 인증을 찾는다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.findValidByUserIdAndType("user-123", "EMAIL_VERIFY");

      // Then
      expect(result).toEqual(mockVerification);
      assertNativeWhere(
        "Verification",
        db.orm.public.Verification.where.mock.calls[0]?.[0],
        (row) =>
          and(
            row.userId.eq("user-123"),
            row._type.eq("EMAIL_VERIFY"),
            row.usedAt.isNull(),
            row.expiresAt.gt(expect.any(String)),
          ),
      );
    });

    it("활성 트랜잭션 클라이언트로 조회한다", async () => {
      // Given
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", mockVerification),
      );

      // When
      const result = await repository.findValidByUserIdAndType("user-123", "EMAIL_VERIFY");

      // Then
      expect(result).toEqual(mockVerification);
      expect(db.orm.public.Verification.first).toHaveBeenCalled();
    });
  });

  describe("markAsUsed", () => {
    const usedVerification: Verification = {
      ...mockVerification,
      usedAt: new Date("2025-01-15T10:00:00Z"),
    };

    it("인증 토큰을 사용됨으로 표시한다", async () => {
      // Given
      db.orm.public.Verification.update.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );

      // When
      const result = await repository.markAsUsed(1);

      // Then
      expect(result).toEqual(usedVerification);
      expect(db.orm.public.Verification.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", { usedAt: expect.any(String) }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 업데이트한다", async () => {
      // Given
      db.orm.public.Verification.update.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );

      // When
      const result = await repository.markAsUsed(1);

      // Then
      expect(result).toEqual(usedVerification);
      expect(db.orm.public.Verification.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", { usedAt: expect.any(String) }),
        ),
      );
    });
  });

  describe("incrementAttempts", () => {
    const incrementedVerification: Verification = {
      ...mockVerification,
      attempts: 1,
    };

    it("시도 횟수를 1 증가시킨다 (베이스 클라이언트 사용)", async () => {
      // Given
      baseDb.query.mockResolvedValue([databaseFixture("Verification", incrementedVerification)]);

      // When
      const result = await repository.incrementAttempts(1);

      // Then
      expect(result).toEqual(incrementedVerification);
      expect(baseDb.query).toHaveBeenCalledOnce();
      expect(db.query).not.toHaveBeenCalled();
    });

    it("활성 트랜잭션을 우회해 베이스 클라이언트로 증가시킨다", async () => {
      // Given
      baseDb.query.mockResolvedValue([databaseFixture("Verification", incrementedVerification)]);

      // When
      const result = await repository.incrementAttempts(1);

      // Then
      expect(result).toEqual(incrementedVerification);
      expect(baseDb.query).toHaveBeenCalledOnce();
      expect(db.query).not.toHaveBeenCalled();
      expect(db.orm.public.Verification.update).not.toHaveBeenCalled();
    });
  });

  describe("markAsUsedAtomic", () => {
    const usedVerification: Verification = {
      ...mockVerification,
      usedAt: new Date("2025-01-15T10:00:00Z"),
    };

    it("조건을 충족하면 원자적으로 사용됨 표시를 한다", async () => {
      // Given
      db.orm.public.Verification.update.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );

      // When
      const result = await repository.markAsUsedAtomic(
        "hashed-token-123",
        "user-123",
        "EMAIL_VERIFY",
        5,
      );

      // Then
      expect(result).toEqual(usedVerification);
      expect(db.orm.public.Verification.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", { usedAt: expect.any(String) }),
        ),
      );
      assertNativeWhere(
        "Verification",
        db.orm.public.Verification.where.mock.calls[0]?.[0],
        (row) =>
          and(
            row.token.eq(varchar("hashed-token-123", 64)),
            row.userId.eq("user-123"),
            row._type.eq("EMAIL_VERIFY"),
            row.usedAt.isNull(),
            row.expiresAt.gt(expect.any(String)),
            row.attempts.lt(5),
          ),
      );
    });

    it("조건을 충족하지 않으면 null을 반환한다", async () => {
      // Given
      db.orm.public.Verification.update.mockResolvedValue(null);

      // When
      const result = await repository.markAsUsedAtomic(
        "invalid-token",
        "user-123",
        "EMAIL_VERIFY",
        5,
      );

      // Then
      expect(result).toBeNull();
      expect(db.orm.public.Verification.first).not.toHaveBeenCalled();
    });

    it("활성 트랜잭션 클라이언트로 처리한다", async () => {
      // Given
      db.orm.public.Verification.update.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );
      db.orm.public.Verification.first.mockResolvedValue(
        databaseFixture("Verification", usedVerification),
      );

      // When
      const result = await repository.markAsUsedAtomic(
        "hashed-token-123",
        "user-123",
        "EMAIL_VERIFY",
        5,
      );

      // Then
      expect(result).toEqual(usedVerification);
      expect(db.orm.public.Verification.update).toHaveBeenCalled();
      expect(db.orm.public.Verification.first).not.toHaveBeenCalled();
    });
  });

  describe("invalidateAllByUserIdAndType", () => {
    it("사용자의 특정 타입 미사용 인증을 모두 무효화한다", async () => {
      // Given
      db.orm.public.Verification.updateAndCount.mockResolvedValue(3);

      // When
      const result = await repository.invalidateAllByUserIdAndType("user-123", "EMAIL_VERIFY");

      // Then
      expect(result).toBe(3);
      expect(db.orm.public.Verification.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Verification", { expiresAt: expect.any(String) }),
        ),
      );
    });

    it("무효화할 인증이 없으면 0을 반환한다", async () => {
      // Given
      db.orm.public.Verification.updateAndCount.mockResolvedValue(0);

      // When
      const result = await repository.invalidateAllByUserIdAndType("user-123", "PASSWORD_RESET");

      // Then
      expect(result).toBe(0);
    });

    it("활성 트랜잭션 클라이언트로 무효화한다", async () => {
      // Given
      db.orm.public.Verification.updateAndCount.mockResolvedValue(2);

      // When
      const result = await repository.invalidateAllByUserIdAndType("user-123", "EMAIL_VERIFY");

      // Then
      expect(result).toBe(2);
      expect(db.orm.public.Verification.updateAndCount).toHaveBeenCalled();
    });
  });

  describe("countRecentByUserIdAndType", () => {
    it("특정 기간 내 인증 발송 횟수를 카운트한다", async () => {
      // Given
      db.orm.public.Verification.aggregate.mockResolvedValue({ count: 3 });
      const since = new Date("2025-01-14T00:00:00Z");

      // When
      const result = await repository.countRecentByUserIdAndType("user-123", "EMAIL_VERIFY", since);

      // Then
      expect(result).toBe(3);
      assertNativeWhere(
        "Verification",
        db.orm.public.Verification.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.userId.eq("user-123"),
            row._type.eq("EMAIL_VERIFY"),
            row.createdAt.gte(databaseTimestamp(since)),
          ),
      );
    });

    it("활성 트랜잭션 클라이언트로 카운트한다", async () => {
      // Given
      db.orm.public.Verification.aggregate.mockResolvedValue({ count: 5 });
      const since = new Date("2025-01-14T00:00:00Z");

      // When
      const result = await repository.countRecentByUserIdAndType("user-123", "EMAIL_VERIFY", since);

      // Then
      expect(result).toBe(5);
      expect(db.orm.public.Verification.aggregate).toHaveBeenCalled();
    });
  });

  describe("deleteExpired", () => {
    it("만료된 인증과 사용된 인증을 삭제한다 (베이스 클라이언트 사용)", async () => {
      // Given
      baseDb.orm.public.Verification.deleteAndCount.mockResolvedValue(10);

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(result).toBe(10);
      assertNativeWhere(
        "Verification",
        baseDb.orm.public.Verification.where.mock.calls.at(-1)?.[0],
        (row) => or(row.expiresAt.lt(expect.any(String)), row.usedAt.isNotNull()),
      );
    });

    it("삭제할 인증이 없으면 0을 반환한다", async () => {
      // Given
      baseDb.orm.public.Verification.deleteAndCount.mockResolvedValue(0);

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(result).toBe(0);
    });
  });
});

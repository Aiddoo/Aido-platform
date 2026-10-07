/**
 * UserConsentRepository 리포지토리 단위 테스트
 *
 * @description
 * UserConsentRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test user-consent.repository
 * ```
 */
import { vi } from "vitest";

import type { UserConsent } from "#api/platform/database/database.types";
import { UserConsentBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { UserConsentRepository } from "./user-consent.repository.js";

describe("UserConsentRepository — 사용자 동의 리포지토리", () => {
  let repository: UserConsentRepository;
  let db: MockDatabaseContext;

  const userId = "user-123";
  const now = new Date("2024-01-15T10:00:00Z");

  const mockConsent = UserConsentBuilder.create(userId)
    .withId("consent-1")
    .withTermsAgreedAt(new Date("2024-01-01T00:00:00Z"))
    .withPrivacyAgreedAt(new Date("2024-01-01T00:00:00Z"))
    .withAgreedTermsVersion("1.0.0")
    .withMarketingConsent()
    .build();
  // Override marketingAgreedAt to match the specific date
  mockConsent.marketingAgreedAt = new Date("2024-01-01T00:00:00Z");

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Given - Suites가 모든 의존성을 자동으로 mock
    db = createMockDatabaseContext();

    repository = new UserConsentRepository(createMockTransactionHost(db));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("findByUserId", () => {
    it("사용자 ID로 약관 동의 상태를 조회한다", async () => {
      // Given
      db.orm.public.UserConsent.first.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.findByUserId(userId);

      // Then
      expect(result).toEqual(mockConsent);
      assertNativeWhere("UserConsent", db.orm.public.UserConsent.where.mock.calls[0]?.[0], (row) =>
        row.userId.eq(userId),
      );
    });

    it("동의 레코드가 없으면 null을 반환한다", async () => {
      // Given
      db.orm.public.UserConsent.first.mockResolvedValue(databaseFixture("UserConsent", null));

      // When
      const result = await repository.findByUserId(userId);

      // Then
      expect(result).toBeNull();
    });

    it("활성 트랜잭션 클라이언트로 조회한다", async () => {
      // Given
      db.orm.public.UserConsent.first.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.findByUserId(userId);

      // Then
      expect(result).toEqual(mockConsent);
      assertNativeWhere("UserConsent", db.orm.public.UserConsent.where.mock.calls[0]?.[0], (row) =>
        row.userId.eq(userId),
      );
    });
  });

  describe("create", () => {
    it("기본값(null)으로 동의 레코드를 생성한다", async () => {
      // Given
      const createdConsent: UserConsent = {
        id: "consent-new",
        userId,
        termsAgreedAt: null,
        privacyAgreedAt: null,
        agreedTermsVersion: null,
        marketingAgreedAt: null,
        marketingPushAgreedAt: null,
      };
      db.orm.public.UserConsent.create.mockResolvedValue(
        databaseFixture("UserConsent", createdConsent),
      );

      // When
      const result = await repository.create(userId);

      // Then
      expect(result).toEqual(createdConsent);
      expect(db.orm.public.UserConsent.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("UserConsent", {
            userId,
            termsAgreedAt: null,
            privacyAgreedAt: null,
            agreedTermsVersion: null,
            marketingAgreedAt: null,
            marketingPushAgreedAt: null,
          }),
        ),
      );
    });

    it("지정된 값으로 동의 레코드를 생성한다", async () => {
      // Given
      const termsDate = new Date("2024-01-01T00:00:00Z");
      const privacyDate = new Date("2024-01-01T00:00:00Z");
      const marketingDate = new Date("2024-01-01T00:00:00Z");

      db.orm.public.UserConsent.create.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.create(userId, {
        termsAgreedAt: termsDate,
        privacyAgreedAt: privacyDate,
        agreedTermsVersion: "1.0.0",
        marketingAgreedAt: marketingDate,
      });

      // Then
      expect(result).toEqual(mockConsent);
      expect(db.orm.public.UserConsent.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("UserConsent", {
            userId,
            termsAgreedAt: termsDate,
            privacyAgreedAt: privacyDate,
            agreedTermsVersion: "1.0.0",
            marketingAgreedAt: marketingDate,
            marketingPushAgreedAt: null,
          }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 생성한다", async () => {
      // Given
      const createdConsent: UserConsent = {
        id: "consent-new",
        userId,
        termsAgreedAt: null,
        privacyAgreedAt: null,
        agreedTermsVersion: null,
        marketingAgreedAt: null,
        marketingPushAgreedAt: null,
      };
      db.orm.public.UserConsent.create.mockResolvedValue(
        databaseFixture("UserConsent", createdConsent),
      );

      // When
      const result = await repository.create(userId, undefined);

      // Then
      expect(result).toEqual(createdConsent);
      expect(db.orm.public.UserConsent.create).toHaveBeenCalled();
    });
  });

  describe("upsert", () => {
    it("동의 레코드가 없으면 생성한다", async () => {
      // Given
      const termsDate = new Date("2024-01-01T00:00:00Z");
      const privacyDate = new Date("2024-01-01T00:00:00Z");

      const createdConsent: UserConsent = {
        id: "consent-new",
        userId,
        termsAgreedAt: termsDate,
        privacyAgreedAt: privacyDate,
        agreedTermsVersion: "1.0.0",
        marketingAgreedAt: null,
        marketingPushAgreedAt: null,
      };
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", createdConsent),
      );

      // When
      const result = await repository.upsert(userId, {
        termsAgreedAt: termsDate,
        privacyAgreedAt: privacyDate,
        agreedTermsVersion: "1.0.0",
      });

      // Then
      expect(result).toEqual(createdConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictOn: databaseWriteExpectation("UserConsent", { userId }),
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              userId,
              termsAgreedAt: termsDate,
              privacyAgreedAt: privacyDate,
              agreedTermsVersion: "1.0.0",
              marketingAgreedAt: null,
              marketingPushAgreedAt: null,
            }),
          ),
          update: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              termsAgreedAt: termsDate,
              privacyAgreedAt: privacyDate,
              agreedTermsVersion: "1.0.0",
            }),
          ),
        }),
      );
    });

    it("동의 레코드가 있으면 업데이트한다", async () => {
      // Given
      const newVersion = "2.0.0";
      const updatedConsent: UserConsent = {
        ...mockConsent,
        agreedTermsVersion: newVersion,
      };
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", updatedConsent),
      );

      // When
      const result = await repository.upsert(userId, {
        agreedTermsVersion: newVersion,
      });

      // Then
      expect(result).toEqual(updatedConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictOn: databaseWriteExpectation("UserConsent", { userId }),
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              userId,
              termsAgreedAt: null,
              privacyAgreedAt: null,
              agreedTermsVersion: newVersion,
              marketingAgreedAt: null,
              marketingPushAgreedAt: null,
            }),
          ),
          update: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              agreedTermsVersion: newVersion,
            }),
          ),
        }),
      );
    });

    it("활성 트랜잭션 클라이언트로 upsert한다", async () => {
      // Given
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.upsert(userId, {
        agreedTermsVersion: "1.0.0",
      });

      // Then
      expect(result).toEqual(mockConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalled();
    });
  });

  describe("updateMarketingConsent", () => {
    it("마케팅 동의를 활성화한다 (현재 시간으로 설정)", async () => {
      // Given
      const updatedConsent: UserConsent = {
        ...mockConsent,
        marketingAgreedAt: now,
        marketingPushAgreedAt: null,
      };
      db.orm.public.UserConsent.update.mockResolvedValue(
        databaseFixture("UserConsent", updatedConsent),
      );

      // When
      const result = await repository.updateMarketingConsent(userId, {
        agreed: true,
      });

      // Then
      expect(result).toEqual(updatedConsent);
      expect(db.orm.public.UserConsent.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("UserConsent", {
            marketingAgreedAt: now,
          }),
        ),
      );
    });

    it("마케팅 동의를 철회한다 (null로 설정)", async () => {
      // Given
      const updatedConsent: UserConsent = {
        ...mockConsent,
        marketingAgreedAt: null,
      };
      db.orm.public.UserConsent.update.mockResolvedValue(
        databaseFixture("UserConsent", updatedConsent),
      );

      // When
      const result = await repository.updateMarketingConsent(userId, {
        agreed: false,
      });

      // Then
      expect(result).toEqual(updatedConsent);
      expect(db.orm.public.UserConsent.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("UserConsent", {
            marketingAgreedAt: null,
          }),
        ),
      );
    });

    it("활성 트랜잭션 클라이언트로 업데이트한다", async () => {
      // Given
      db.orm.public.UserConsent.update.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.updateMarketingConsent(userId, {
        agreed: true,
      });

      // Then
      expect(result).toEqual(mockConsent);
      expect(db.orm.public.UserConsent.update).toHaveBeenCalled();
    });
  });

  describe("upsertMarketingConsent", () => {
    it("동의 레코드가 없으면 마케팅 동의와 함께 생성한다", async () => {
      // Given
      const createdConsent: UserConsent = {
        id: "consent-new",
        userId,
        termsAgreedAt: null,
        privacyAgreedAt: null,
        agreedTermsVersion: null,
        marketingAgreedAt: now,
        marketingPushAgreedAt: null,
      };
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", createdConsent),
      );

      // When
      const result = await repository.upsertMarketingConsent(userId, {
        agreed: true,
      });

      // Then
      expect(result).toEqual(createdConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictOn: databaseWriteExpectation("UserConsent", { userId }),
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              userId,
              marketingAgreedAt: now,
            }),
          ),
          update: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              marketingAgreedAt: now,
            }),
          ),
        }),
      );
    });

    it("마케팅 동의 거부 시 null로 설정한다", async () => {
      // Given
      const updatedConsent: UserConsent = {
        ...mockConsent,
        marketingAgreedAt: null,
      };
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", updatedConsent),
      );

      // When
      const result = await repository.upsertMarketingConsent(userId, {
        agreed: false,
      });

      // Then
      expect(result).toEqual(updatedConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictOn: databaseWriteExpectation("UserConsent", { userId }),
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              userId,
              marketingAgreedAt: null,
            }),
          ),
          update: expect.objectContaining(
            databaseWriteExpectation("UserConsent", {
              marketingAgreedAt: null,
            }),
          ),
        }),
      );
    });

    it("활성 트랜잭션 클라이언트로 upsert한다", async () => {
      // Given
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", mockConsent),
      );

      // When
      const result = await repository.upsertMarketingConsent(userId, {
        agreed: true,
      });

      // Then
      expect(result).toEqual(mockConsent);
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalled();
    });
  });
});

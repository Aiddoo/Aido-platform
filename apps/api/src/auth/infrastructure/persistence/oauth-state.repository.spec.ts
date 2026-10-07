import { and } from "@prisma/orm-postgres/orm-client";
/**
 * OAuthStateRepository 단위 테스트
 *
 * @description
 * OAuth 상태 저장소의 CRUD, 교환 코드 관리 메서드를 검증한다.
 * 토큰 암호화, 교환 완료 처리, 만료 삭제를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test oauth-state.repository.spec.ts
 * ```
 */
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { varchar } from "#api/shared/infrastructure/database/database-values";
import { EncryptionService } from "#api/shared/infrastructure/encryption/index";
import {
  assertNativeWhere,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { OAuthStateRepository } from "./oauth-state.repository.js";

describe("OAuthStateRepository — OAuth 상태 리포지토리", () => {
  let repository: OAuthStateRepository;
  let db: ReturnType<typeof createMockDatabaseService>;
  let encryptionService: Mocked<EncryptionService>;

  const mockOAuthState = {
    id: 1,
    state: "test-state",
    provider: "KAKAO" as const,
    redirectUri: "http://localhost:3000/callback",
    mode: null,
    codeVerifier: null,
    ipAddress: null,
    userAgent: null,
    initiatingUserId: null,
    exchangeCode: null,
    accessToken: null,
    refreshToken: null,
    userId: null,
    userName: null,
    profileImage: null,
    accountRestored: null,
    exchangedAt: null,
    expiresAt: new Date("2024-12-31"),
    createdAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    db = createMockDatabaseService();
    encryptionService = mock<EncryptionService>();
    repository = new OAuthStateRepository(db, encryptionService);

    // encrypt를 "encrypted-{value}" 형태로 반환하도록 설정
    encryptionService.encrypt.mockImplementation((value: string) => `encrypted-${value}`);
    encryptionService.decryptSafe.mockImplementation((value: string) =>
      value.replace("encrypted-", ""),
    );
  });

  describe("create", () => {
    it("OAuth 상태를 생성한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.create).mockResolvedValue(
        databaseFixture("OAuthState", mockOAuthState),
      );

      // When
      const result = await repository.create(
        "test-state",
        "KAKAO",
        "http://localhost:3000/callback",
      );

      // Then
      expect(result).toEqual(mockOAuthState);
      expect(db.db.orm.public.OAuthState.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            state: "test-state",
            provider: "KAKAO",
            redirectUri: "http://localhost:3000/callback",
            expiresAt: expect.any(String),
          }),
        ),
      );
    });

    it("옵션과 함께 OAuth 상태를 생성한다", async () => {
      // Given
      const stateWithOptions = {
        ...mockOAuthState,
        mode: "link" as const,
        codeVerifier: "test-verifier",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        initiatingUserId: "user-123",
      };
      vi.mocked(db.db.orm.public.OAuthState.create).mockResolvedValue(
        databaseFixture("OAuthState", stateWithOptions),
      );

      // When
      const result = await repository.create(
        "test-state",
        "KAKAO",
        "http://localhost:3000/callback",
        {
          mode: "link",
          codeVerifier: "test-verifier",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          expiresInMinutes: 15,
          initiatingUserId: "user-123",
        },
      );

      // Then
      expect(result).toEqual(stateWithOptions);
      expect(db.db.orm.public.OAuthState.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            state: "test-state",
            provider: "KAKAO",
            redirectUri: "http://localhost:3000/callback",
            mode: "link",
            codeVerifier: "test-verifier",
            ipAddress: "127.0.0.1",
            userAgent: "Mozilla/5.0",
            initiatingUserId: "user-123",
          }),
        ),
      );
    });
  });

  describe("findByState", () => {
    it("state 값으로 OAuth 상태를 찾는다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.first).mockResolvedValue(
        databaseFixture("OAuthState", mockOAuthState),
      );

      // When
      const result = await repository.findByState("test-state");

      // Then
      expect(result).toEqual(mockOAuthState);
      assertNativeWhere("OAuthState", db.db.orm.public.OAuthState.where.mock.calls[0]?.[0], (row) =>
        and(row.state.eq(varchar("test-state", 64)), row.expiresAt.gt(expect.any(String))),
      );
    });

    it("존재하지 않으면 null을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.first).mockResolvedValue(
        databaseFixture("OAuthState", null),
      );

      // When
      const result = await repository.findByState("nonexistent-state");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("findByExchangeCode", () => {
    it("교환 코드로 아직 교환되지 않은 상태를 찾는다", async () => {
      // Given
      const stateWithExchangeCode = {
        ...mockOAuthState,
        exchangeCode: "exchange-code-123",
      };
      vi.mocked(db.db.orm.public.OAuthState.first).mockResolvedValue(
        databaseFixture("OAuthState", stateWithExchangeCode),
      );

      // When
      const result = await repository.findByExchangeCode("exchange-code-123");

      // Then
      expect(result).toEqual({
        id: stateWithExchangeCode.id,
        state: stateWithExchangeCode.state,
        provider: stateWithExchangeCode.provider,
        redirectUri: stateWithExchangeCode.redirectUri,
        mode: stateWithExchangeCode.mode,
        initiatingUserId: stateWithExchangeCode.initiatingUserId,
        exchangeCode: stateWithExchangeCode.exchangeCode,
        accessToken: stateWithExchangeCode.accessToken,
        refreshToken: stateWithExchangeCode.refreshToken,
        userId: stateWithExchangeCode.userId,
        userName: stateWithExchangeCode.userName,
        profileImage: stateWithExchangeCode.profileImage,
        accountRestored: stateWithExchangeCode.accountRestored,
      });
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("expiresAt");
      expect(result).not.toHaveProperty("codeVerifier");
      assertNativeWhere("OAuthState", db.db.orm.public.OAuthState.where.mock.calls[0]?.[0], (row) =>
        and(
          row.exchangeCode.eq(varchar("exchange-code-123", 64)),
          row.exchangedAt.isNull(),
          row.expiresAt.gt(expect.any(String)),
        ),
      );
    });

    it("교환 코드의 암호화된 토큰을 복호화하여 반환한다", async () => {
      // Given - DB에는 암호화된 토큰이 저장되어 있음
      vi.mocked(db.db.orm.public.OAuthState.first).mockResolvedValue(
        databaseFixture("OAuthState", {
          ...mockOAuthState,
          exchangeCode: "exchange-code-123",
          accessToken: "encrypted-access-token",
          refreshToken: "encrypted-refresh-token",
        }),
      );

      // When
      const result = await repository.findByExchangeCode("exchange-code-123");

      // Then - 복호화 책임은 인프라 어댑터에서 끝남
      expect(result).toMatchObject({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(encryptionService.decryptSafe).toHaveBeenCalledWith("encrypted-access-token");
      expect(encryptionService.decryptSafe).toHaveBeenCalledWith("encrypted-refresh-token");
    });

    it("교환 코드가 없으면 null을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.first).mockResolvedValue(
        databaseFixture("OAuthState", null),
      );

      // When
      const result = await repository.findByExchangeCode("nonexistent");

      // Then
      expect(result).toBeNull();
    });
  });

  describe("saveExchangeData", () => {
    it("교환 데이터를 저장하고 토큰을 암호화한다", async () => {
      // Given
      const updatedState = {
        ...mockOAuthState,
        exchangeCode: "exchange-code-123",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        userId: "oauth-user-id",
        userName: "홍길동",
        profileImage: "https://example.com/photo.jpg",
      };
      vi.mocked(db.db.orm.public.OAuthState.update).mockResolvedValue(
        databaseFixture("OAuthState", updatedState),
      );

      // When
      const result = await repository.saveExchangeData(1, {
        exchangeCode: "exchange-code-123",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: "oauth-user-id",
        userName: "홍길동",
        profileImage: "https://example.com/photo.jpg",
      });

      // Then
      expect(result).toEqual(updatedState);
      expect(encryptionService.encrypt).toHaveBeenCalledWith("access-token");
      expect(encryptionService.encrypt).toHaveBeenCalledWith("refresh-token");
      expect(db.db.orm.public.OAuthState.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            exchangeCode: "exchange-code-123",
            accessToken: "encrypted-access-token",
            refreshToken: "encrypted-refresh-token",
            userId: "oauth-user-id",
            userName: "홍길동",
            profileImage: "https://example.com/photo.jpg",
          }),
        ),
      );
    });
  });

  describe("saveLinkingData", () => {
    it("계정 연결 모드 교환 데이터를 저장한다", async () => {
      // Given
      const updatedState = {
        ...mockOAuthState,
        exchangeCode: "exchange-code-123",
        provider: "GOOGLE" as const,
        userId: "provider-account-id",
      };
      vi.mocked(db.db.orm.public.OAuthState.update).mockResolvedValue(
        databaseFixture("OAuthState", updatedState),
      );

      // When
      const result = await repository.saveLinkingData(1, {
        exchangeCode: "exchange-code-123",
        provider: "GOOGLE",
        providerAccountId: "provider-account-id",
      });

      // Then
      expect(result).toEqual(updatedState);
      expect(db.db.orm.public.OAuthState.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            exchangeCode: "exchange-code-123",
            provider: "GOOGLE",
            userId: "provider-account-id",
          }),
        ),
      );
    });
  });

  describe("markAsExchanged", () => {
    it("교환 완료 처리하고 토큰을 삭제한다", async () => {
      // Given
      const exchangedState = {
        ...mockOAuthState,
        exchangedAt: new Date(),
        accessToken: null,
        refreshToken: null,
      };
      vi.mocked(db.db.orm.public.OAuthState.update).mockResolvedValue(
        databaseFixture("OAuthState", exchangedState),
      );

      // When
      const result = await repository.markAsExchanged(1);

      // Then
      expect(result).toEqual(exchangedState);
      expect(db.db.orm.public.OAuthState.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            exchangedAt: expect.any(String),
            accessToken: null,
            refreshToken: null,
          }),
        ),
      );
    });
  });

  describe("delete", () => {
    it("ID로 OAuth 상태를 삭제한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.delete).mockResolvedValue(
        databaseFixture("OAuthState", mockOAuthState),
      );

      // When
      await repository.delete(1);

      // Then
      assertNativeWhere(
        "OAuthState",
        db.db.orm.public.OAuthState.where.mock.calls.at(-1)?.[0],
        (row) => row.id.eq(1),
      );
    });
  });

  describe("deleteExpired", () => {
    it("만료된 레코드를 삭제하고 삭제 수를 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.deleteAndCount).mockResolvedValue(5);

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(result).toBe(5);
      assertNativeWhere(
        "OAuthState",
        db.db.orm.public.OAuthState.where.mock.calls.at(-1)?.[0],
        (row) => row.expiresAt.lt(expect.any(String)),
      );
    });

    it("만료된 레코드가 없으면 0을 반환한다", async () => {
      // Given
      vi.mocked(db.db.orm.public.OAuthState.deleteAndCount).mockResolvedValue(0);

      // When
      const result = await repository.deleteExpired();

      // Then
      expect(result).toBe(0);
    });
  });

  describe("generateExchangeCode", () => {
    it("base64url 형식의 교환 코드를 생성한다", () => {
      // Given & When
      const code = repository.generateExchangeCode();

      // Then
      expect(code).toBeDefined();
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    });

    it("호출할 때마다 다른 코드를 생성한다", () => {
      // Given & When
      const code1 = repository.generateExchangeCode();
      const code2 = repository.generateExchangeCode();

      // Then
      expect(code1).not.toBe(code2);
    });
  });
});

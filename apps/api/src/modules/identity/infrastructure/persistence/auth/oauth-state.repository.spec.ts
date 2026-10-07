import { and, or } from "@prisma/orm-postgres/orm-client";
import type { Mocked } from "vitest";
import { mock } from "vitest-mock-extended";

import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { OAuthState } from "#api/platform/database/database.types";
import { EncryptionService } from "#api/platform/encryption/index";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { OAuthStateRepository } from "./oauth-state.repository.js";

const at = new Date("2027-01-01T00:00:00.000Z");

const fixture = {
  ...OAuthStateFixture.create({
    id: 1,
    state: "state",
    provider: "GOOGLE",
    exchangeCode: "code",
    accessToken: "encrypted-access",
    refreshToken: "encrypted-refresh",
    userId: "owner",
    expiresAt: new Date(at.getTime() + 60_000),
  }),
  codeVerifier: null,
  ipAddress: null,
  userAgent: null,
  createdAt: at,
} satisfies OAuthState;

describe("OAuthStateRepository — 일회용 소비와 암호화 경계", () => {
  let repository: OAuthStateRepository;
  let db: MockDatabaseContext;
  let encryption: Mocked<EncryptionService>;

  beforeEach(() => {
    db = createMockDatabaseContext();
    encryption = mock<EncryptionService>();
    encryption.encrypt.mockImplementation((value) => `encrypted-${value}`);
    encryption.decryptSafe.mockImplementation((value) => value.replace("encrypted-", ""));
    repository = new OAuthStateRepository(createMockTransactionHost(db), encryption);
  });

  it.each([
    { count: 1, consumed: true },
    { count: 0, consumed: false },
  ])(
    "login 소비 변경 수 $count에 따라 결과를 반환하고 토큰을 제거한다",
    async ({ count, consumed }) => {
      // Given
      db.orm.public.OAuthState.updateAndCount.mockResolvedValue(count);
      // When
      const result = await repository.consumeExchangeCode({
        id: 1,
        exchangeCode: "code",
        at,
        purpose: "login",
      });
      // Then
      expect(result).toBe(consumed);
      assertNativeWhere("OAuthState", db.orm.public.OAuthState.where.mock.calls[0]?.[0], (row) =>
        and(
          row.id.eq(1),
          row.exchangeCode.eq(varchar("code", 64)),
          row.exchangedAt.isNull(),
          row.expiresAt.gt(databaseTimestamp(at)),
        ),
      );
      expect(db.orm.public.OAuthState.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("OAuthState", {
            exchangedAt: at,
            accessToken: null,
            refreshToken: null,
          }),
        ),
      );
    },
  );

  it("link 소비에는 목적과 legacy actor 또는 실제 소유자 조건을 UPDATE에 포함한다", async () => {
    // Given
    db.orm.public.OAuthState.updateAndCount.mockResolvedValue(1);
    // When
    await repository.consumeExchangeCode({
      id: 1,
      exchangeCode: "code",
      at,
      purpose: "link",
      actorUserId: "owner",
    });
    // Then
    assertNativeWhere("OAuthState", db.orm.public.OAuthState.where.mock.calls[0]?.[0], (row) =>
      and(
        row.id.eq(1),
        row.exchangeCode.eq(varchar("code", 64)),
        row.exchangedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(at)),
        row.mode.eq(varchar("link", 10)),
        or(
          row.initiatingUserId.isNull(),
          row.initiatingUserId.eq(varchar("", 36)),
          row.initiatingUserId.eq(varchar("owner", 36)),
        ),
      ),
    );
  });

  it("교환 조회는 동일 기준 시각으로 만료를 검사하고 복호화된 토큰을 반환한다", async () => {
    // Given
    db.orm.public.OAuthState.first.mockResolvedValue(databaseFixture("OAuthState", fixture));
    // When
    const state = await repository.findByExchangeCode("code", at);
    // Then
    expect(state).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: fixture.expiresAt,
      exchangedAt: null,
    });
    assertNativeWhere("OAuthState", db.orm.public.OAuthState.where.mock.calls[0]?.[0], (row) =>
      and(
        row.exchangeCode.eq(varchar("code", 64)),
        row.exchangedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(at)),
      ),
    );
  });

  it("발급한 토큰은 암호화해 저장한다", async () => {
    // Given
    db.orm.public.OAuthState.update.mockResolvedValue(databaseFixture("OAuthState", fixture));
    // When
    await repository.saveExchangeData(1, {
      exchangeCode: "code",
      accessToken: "access",
      refreshToken: "refresh",
      userId: "owner",
    });
    // Then
    expect(db.orm.public.OAuthState.update).toHaveBeenCalledWith(
      expect.objectContaining(
        databaseWriteExpectation("OAuthState", {
          accessToken: "encrypted-access",
          refreshToken: "encrypted-refresh",
        }),
      ),
    );
  });
});

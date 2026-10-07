import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { AccountFixture } from "#test/fixtures/user.fixture";

import { AuthPersistenceConflict } from "../../ports/auth/auth-persistence.port.js";

describe("LinkOAuthIdentity — 소셜 신원 연결의 공통 저장 계약", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("신원을 연결하고 요청 정보가 없으면 기본값으로 감사 기록을 남긴다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    // When
    const result = await fixture.linkOAuthIdentity.execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // Then
    expect(result).toEqual({ message: "계정이 연결되었습니다.", linked: true });
    expect(
      await fixture.accountRepository.findByProviderAccountId("GOOGLE", "google-account"),
    ).toMatchObject({ userId: fixture.user.id, password: null });
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.OAUTH_LINKED,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider: "GOOGLE", providerAccountId: "google-account" },
      },
    ]);
  });

  it("이미 자신의 계정이면 새 연결과 감사 기록을 만들지 않는다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    fixture.accountRepository.accounts.push(
      AccountFixture.create({
        userId: fixture.user.id,
        provider: "GOOGLE",
        providerAccountId: "google-account",
      }),
    );
    // When
    const result = await fixture.linkOAuthIdentity.execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // Then
    expect(result).toEqual({ message: "이미 연결된 계정입니다.", linked: false });
    expect(fixture.accountRepository.accounts).toHaveLength(2);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it.each([
    { provider: "APPLE", errorCode: ErrorCode.APPLE_0355, details: { appleId: "other-account" } },
    {
      provider: "GOOGLE",
      errorCode: ErrorCode.GOOGLE_0405,
      details: { googleId: "other-account" },
    },
    { provider: "KAKAO", errorCode: ErrorCode.KAKAO_0306, details: { kakaoId: "other-account" } },
    { provider: "NAVER", errorCode: ErrorCode.NAVER_0455, details: { naverId: "other-account" } },
  ] satisfies Array<{
    provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER";
    errorCode: string;
    details: object;
  }>)(
    "$provider: 다른 사용자의 신원 충돌을 기존 오류와 세부 정보로 반환한다",
    async ({ provider, errorCode, details }) => {
      // Given
      const fixture = createAuthOAuthFixture(provider);
      fixture.accountRepository.accounts.push(
        AccountFixture.create({
          userId: "other-user",
          provider,
          providerAccountId: "other-account",
        }),
      );
      // When
      const pending = fixture.linkOAuthIdentity.execute({
        userId: fixture.user.id,
        provider,
        providerAccountId: "other-account",
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.accountRepository.accounts).toHaveLength(2);
    },
  );

  it("조회 이후 저장 시 신원 충돌도 동일 오류로 정규화하고 다른 저장 오류는 그대로 전달한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    const createAccount = vi.spyOn(fixture.accountRepository, "createOAuthAccount");
    createAccount.mockRejectedValueOnce(
      new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED"),
    );
    const input = {
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    } satisfies Parameters<typeof fixture.linkOAuthIdentity.execute>[0];
    // When / Then
    await expect(fixture.linkOAuthIdentity.execute(input)).rejects.toMatchObject({
      errorCode: ErrorCode.GOOGLE_0405,
      details: { googleId: "google-account" },
    });
    const storageError = new Error("저장 실패");
    createAccount.mockRejectedValueOnce(storageError);
    await expect(fixture.linkOAuthIdentity.execute(input)).rejects.toBe(storageError);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});

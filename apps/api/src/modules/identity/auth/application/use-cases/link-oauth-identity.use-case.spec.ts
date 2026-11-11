import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";

import { LinkOAuthIdentityUseCase } from "./link-oauth-identity.use-case.js";

describe("LinkOAuthIdentity — 소셜 신원 연결의 공통 저장 계약", () => {
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
    await fixture.accountRepository.createOAuthAccount({
      userId: UserId.reconstitute(fixture.user.id),
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // When
    const result = await fixture.linkOAuthIdentity.execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // Then
    expect(result).toEqual({ message: "이미 연결된 계정입니다.", linked: false });
    expect(fixture.accountRepository.all).toHaveLength(2);
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
      await fixture.accountRepository.createOAuthAccount({
        userId: UserId.reconstitute("other-user"),
        provider,
        providerAccountId: "other-account",
      });
      // When
      const pending = fixture.linkOAuthIdentity.execute({
        userId: fixture.user.id,
        provider,
        providerAccountId: "other-account",
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.accountRepository.all).toHaveLength(2);
    },
  );

  it("조회에 없던 신원이 저장 시 유일 제약에 걸리면 같은 연결 충돌 오류로 정규화한다", async () => {
    // Given
    // 이미 다른 Google 신원을 가진 사용자라 (userId, provider) 유일 제약이 저장 시점에야 걸린다
    const fixture = createAuthOAuthFixture("GOOGLE", { socialOnly: true });
    // When
    const pending = fixture.linkOAuthIdentity.execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.GOOGLE_0405,
      details: { googleId: "google-account" },
    });
    expect(fixture.accountRepository.all).toHaveLength(1);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("연결 충돌이 아닌 저장 오류는 바꾸지 않고 그대로 전달한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    const storageError = new Error("저장 실패");
    const useCase = new LinkOAuthIdentityUseCase({
      ...fixture,
      accountRepository: {
        findByProviderAccountId: async () => null,
        createOAuthAccount: async () => {
          throw storageError;
        },
      },
    });
    // When
    const pending = useCase.execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    // Then
    await expect(pending).rejects.toBe(storageError);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});

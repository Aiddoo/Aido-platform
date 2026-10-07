import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";

import { LinkOAuthAccount } from "./link-oauth-account.use-case.js";

describe("LinkOAuthAccount — 검증된 토큰으로 소셜 신원 연결", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("Apple nonce를 전달하고 커밋이 끝난 뒤 프로필 캐시를 무효화한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture("APPLE");
    fixture.cacheService.userIds.add(fixture.user.id);
    const metadata = { ip: "192.0.2.10", userAgent: "연결 기기" };
    fixture.unitOfWork.run = async <T>(work: () => Promise<T>): Promise<T> => {
      const result = await work();
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
      return result;
    };
    // When
    const result = await new LinkOAuthAccount(fixture).execute({
      userId: fixture.user.id,
      provider: "APPLE",
      idToken: "id-secret",
      accessToken: "unused-token",
      nonce: "nonce",
      metadata,
    });
    // Then
    expect(result).toEqual({ message: "계정이 연결되었습니다." });
    expect(fixture.identityProvider.verifications).toEqual([
      { token: "id-secret", nonce: "nonce" },
    ]);
    expect(
      await fixture.accountRepository.findByProviderAccountId(
        "APPLE",
        fixture.identityProvider.profile.id,
      ),
    ).toMatchObject({ userId: fixture.user.id });
    expect(fixture.securityLogRepository.entries[0]).toMatchObject({
      ipAddress: metadata.ip,
      userAgent: metadata.userAgent,
    });
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
    expect(JSON.stringify(fixture.logger.log.mock.calls)).not.toContain("id-secret");
  });

  it("accessToken으로 연결한 계정을 다시 연결하면 캐시·감사 기록을 추가로 변경하지 않는다", async () => {
    // Given
    const fixture = createAuthOAuthFixture("KAKAO");
    const useCase = new LinkOAuthAccount(fixture);
    const input = {
      userId: fixture.user.id,
      provider: "KAKAO",
      accessToken: "access-secret",
    } satisfies Parameters<LinkOAuthAccount["execute"]>[0];
    await useCase.execute(input);
    fixture.cacheService.userIds.add(fixture.user.id);
    // When
    const result = await useCase.execute(input);
    // Then
    expect(result.message).toBe("이미 연결된 계정입니다.");
    expect(fixture.securityLogRepository.entries).toHaveLength(1);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
  });

  it.each([
    { description: "없는 토큰", idToken: undefined, accessToken: undefined },
    { description: "빈 idToken과 존재하는 accessToken", idToken: "", accessToken: "usable-token" },
  ])("$description: 검증 요청 전에 거부한다", async ({ idToken, accessToken }) => {
    // Given
    const fixture = createAuthOAuthFixture();
    // When
    const pending = new LinkOAuthAccount(fixture).execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      idToken,
      accessToken,
    });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.identityProvider.verifications).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("등록되지 않은 제공자는 USER_0602로 거부한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    // When
    const pending = new LinkOAuthAccount(fixture).execute({
      userId: fixture.user.id,
      provider: "APPLE",
      idToken: "token",
    });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.accountRepository.accounts).toHaveLength(1);
  });

  it("검증 실패는 원래 오류로 반환하고 연결과 캐시를 변경하지 않는다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    fixture.cacheService.userIds.add(fixture.user.id);
    const providerError = new Error("공급자 오류");
    fixture.identityProvider.verificationError = providerError;
    // When
    const pending = new LinkOAuthAccount(fixture).execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      idToken: "token",
    });
    // Then
    await expect(pending).rejects.toBe(providerError);
    expect(fixture.accountRepository.accounts).toHaveLength(1);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});

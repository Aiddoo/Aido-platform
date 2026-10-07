import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { SECURITY_EVENT } from "#api/modules/identity/domain/constants/auth/auth.constants";
import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { AccountFixture } from "#test/fixtures/user.fixture";

import { UnlinkOAuthAccount } from "./unlink-oauth-account.use-case.js";

describe("UnlinkOAuthAccount — 마지막 로그인 수단 보호", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("Credential 로그인을 남긴 채 소셜 연결을 제거하고 커밋 뒤 캐시를 무효화한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    fixture.accountRepository.accounts.push(
      AccountFixture.create({ userId: fixture.user.id, provider: "GOOGLE" }),
    );
    fixture.cacheService.userIds.add(fixture.user.id);
    const metadata = { ip: "192.0.2.20", userAgent: "연결 해제 기기" };
    fixture.unitOfWork.run = async <T>(work: () => Promise<T>): Promise<T> => {
      const result = await work();
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
      return result;
    };
    // When
    const result = await new UnlinkOAuthAccount(fixture).execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      metadata,
    });
    // Then
    expect(result.message).toBe("계정 연결이 해제되었습니다.");
    expect(fixture.accountRepository.accounts.map((account) => account.provider)).toEqual([
      "CREDENTIAL",
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.OAUTH_UNLINKED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { provider: "GOOGLE" },
      },
    ]);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
  });

  it.each([
    {
      description: "없는 제공자",
      provider: "APPLE",
      errorCode: ErrorCode.USER_0603,
      details: { provider: undefined },
    },
    {
      description: "마지막 로그인 수단",
      provider: "GOOGLE",
      errorCode: ErrorCode.USER_0610,
      details: undefined,
    },
  ] satisfies Array<{
    description: string;
    provider: "APPLE" | "GOOGLE";
    errorCode: string;
    details: object | undefined;
  }>)(
    "$description: 기존 오류 우선순위로 거부하고 계정·감사·캐시를 유지한다",
    async ({ provider, errorCode, details }) => {
      // Given
      const fixture = createAuthOAuthFixture("GOOGLE", { socialOnly: true });
      fixture.cacheService.userIds.add(fixture.user.id);
      // When
      const pending = new UnlinkOAuthAccount(fixture).execute({
        userId: fixture.user.id,
        provider,
      });
      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode,
        ...(details === undefined ? {} : { details }),
      });
      expect(fixture.accountRepository.accounts).toHaveLength(1);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    },
  );
});

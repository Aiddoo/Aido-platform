import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { SessionFixture } from "#test/fixtures/session.fixture";
import { AccountFixture } from "#test/fixtures/user.fixture";

import { GetCurrentUser } from "./get-current-user.use-case.js";
import { LoginWithOAuthToken } from "./login-with-oauth-token.use-case.js";

const providers = ["APPLE", "GOOGLE", "KAKAO", "NAVER"] satisfies Array<
  Parameters<LoginWithOAuthToken["execute"]>[0]["provider"]
>;
const metadata = { ip: "192.0.2.40", userAgent: "소셜 로그인 기기" };

describe("LoginWithOAuthToken — 공급자 인증과 사용자 생명주기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function givenExisting(provider: AccountProvider = "GOOGLE") {
    const fixture = createAuthOAuthFixture(provider);
    fixture.accountRepository.accounts.push(
      AccountFixture.create({
        userId: fixture.user.id,
        provider,
        providerAccountId: fixture.identityProvider.profile.id,
      }),
    );
    return { ...fixture, useCase: new LoginWithOAuthToken(fixture) };
  }

  it.each(providers)(
    "%s: 기존 신원을 우선 조회하고 저장된 이메일·역할로 세션을 발급한다",
    async (provider) => {
      // Given
      const fixture = givenExisting(provider);
      fixture.userRepository.users.set(fixture.user.id, {
        ...fixture.user,
        role: "ADMIN",
        status: "PENDING_VERIFY",
      });
      // When
      const result = await fixture.useCase.execute({
        provider,
        token: "token-secret",
        metadata,
        nonce: "apple-nonce",
      });
      // Then
      expect(result.userId).toBe(fixture.user.id);
      expect(result.name).toBe("사용자");
      expect(result.sessionId).toBeTruthy();
      expect(fixture.tokenService.issued).toMatchObject([
        {
          userId: fixture.user.id,
          email: fixture.user.email,
          role: "ADMIN",
          sessionId: result.sessionId,
        },
      ]);
      expect(fixture.sessionRepository.sessions.get(result.sessionId)).toMatchObject({
        userId: fixture.user.id,
        refreshTokenHash: `digest:${result.tokens.refreshToken}`,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      });
      expect(fixture.identityProvider.verifications).toEqual([
        { token: "token-secret", nonce: provider === "APPLE" ? "apple-nonce" : undefined },
      ]);
      expect(fixture.loginAttemptRepository.attempts).toMatchObject([
        { email: fixture.user.email, provider, success: true, ipAddress: metadata.ip },
      ]);
      expect(fixture.securityLogRepository.entries).toMatchObject([
        { event: SECURITY_EVENT.LOGIN_SUCCESS, metadata: { provider } },
      ]);
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
      expect(fixture.retentionEnroller.enrollments).toEqual([]);
      expect(JSON.stringify(fixture.logger.debug.mock.calls)).not.toContain("token-secret");
    },
  );

  it.each(providers)(
    "%s: 검증 실패만 실패 시도로 기록하고 사용자 상태를 변경하지 않는다",
    async (provider) => {
      // Given
      const fixture = givenExisting(provider);
      const verificationError = new Error("검증 실패");
      fixture.identityProvider.verificationError = verificationError;
      // When
      const pending = fixture.useCase.execute({ provider, token: "token-secret" });
      // Then
      await expect(pending).rejects.toBe(verificationError);
      expect(fixture.loginAttemptRepository.attempts).toMatchObject([
        {
          email: fixture.identityProvider.failureEmail,
          provider,
          success: false,
          failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
          ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
          userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        },
      ]);
      expect(fixture.sessionRepository.sessions.size).toBe(0);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
    },
  );

  it.each(providers)(
    "%s: 신규 사용자의 필수 동의·프로필·리텐션을 저장하고 마케팅 동의를 만들지 않는다",
    async (provider) => {
      // Given
      const fixture = createAuthOAuthFixture(provider, { empty: true });
      const userName = "사용자가 직접 지정한 매우 긴 이름입니다";
      // When
      const result = await new LoginWithOAuthToken(fixture).execute({
        provider,
        token: "token",
        userName,
        metadata,
      });
      // Then
      expect(fixture.userRepository.users.get(result.userId)).toMatchObject({
        email: fixture.identityProvider.profile.email,
        status: "ACTIVE",
        emailVerifiedAt: AUTH_CREDENTIAL_TIME,
      });
      expect(fixture.userRepository.profiles.get(result.userId)).toEqual({
        name: userName.slice(0, 20),
        profileImage: provider === "APPLE" ? null : fixture.identityProvider.profile.picture,
      });
      expect(
        await fixture.accountRepository.findByProviderAccountId(
          provider,
          fixture.identityProvider.profile.id,
        ),
      ).toMatchObject({ userId: result.userId, password: null });
      expect(fixture.seeder.settings).toEqual([
        {
          userId: result.userId,
          consent: { termsAgreedAt: AUTH_CREDENTIAL_TIME, privacyAgreedAt: AUTH_CREDENTIAL_TIME },
        },
      ]);
      expect(fixture.seeder.categoryUserIds).toEqual([result.userId]);
      expect(fixture.retentionEnroller.enrollments).toEqual([
        { userId: result.userId, activated: true },
      ]);
      expect(fixture.adminEventNotifier.notifications).toMatchObject([
        {
          userId: result.userId,
          email: fixture.identityProvider.profile.email,
          provider: provider.toLowerCase(),
        },
      ]);
      expect(fixture.securityLogRepository.entries).toMatchObject([
        {
          event: SECURITY_EVENT.REGISTRATION,
          ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
          userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
          metadata: { provider },
        },
        {
          event: SECURITY_EVENT.LOGIN_SUCCESS,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          metadata: { provider },
        },
      ]);
    },
  );

  it("이메일이 없는 소셜 신원은 안정된 placeholder 이메일과 공급자 이름으로 가입한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture("KAKAO", { empty: true });
    fixture.identityProvider.profile.email = null;
    // When
    const result = await new LoginWithOAuthToken(fixture).execute({
      provider: "KAKAO",
      token: "token",
    });
    // Then
    expect(fixture.userRepository.users.get(result.userId)?.email).toBe(
      "kakao_provider-account@social.aido.kr",
    );
    expect(result.name).toBe("소셜 사용자");
  });

  it.each([
    {
      status: "LOCKED",
      errorCode: ErrorCode.USER_0607,
      details: { email: "Social login user", remainingMinutes: undefined },
    },
    {
      status: "SUSPENDED",
      errorCode: ErrorCode.USER_0605,
      details: { userId: "Social login user" },
    },
  ] satisfies Array<{ status: "LOCKED" | "SUSPENDED"; errorCode: string; details: object }>)(
    "$status: 검증된 사용자 상태 오류는 token-invalid 시도로 기록하지 않는다",
    async ({ status, errorCode, details }) => {
      // Given
      const fixture = givenExisting();
      fixture.userRepository.users.set(fixture.user.id, { ...fixture.user, status });
      // When
      const pending = fixture.useCase.execute({ provider: "GOOGLE", token: "token" });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
      expect(fixture.sessionRepository.sessions.size).toBe(0);
    },
  );

  it("신원에 연결된 사용자가 없으면 USER_0601이고 신규 가입·실패 시도를 만들지 않는다", async () => {
    // Given
    const fixture = givenExisting();
    fixture.userRepository.users.delete(fixture.user.id);
    // When
    const pending = fixture.useCase.execute({ provider: "GOOGLE", token: "token" });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0601,
      details: { userId: fixture.user.id },
    });
    expect(fixture.userRepository.users.size).toBe(0);
    expect(fixture.loginAttemptRepository.attempts).toEqual([]);
  });

  it.each(["APPLE", "GOOGLE"] satisfies Array<
    Parameters<LoginWithOAuthToken["execute"]>[0]["provider"]
  >)("%s: 검증된 동일 이메일은 기존 계정에 자동 연결하고 로그인한다", async (provider) => {
    // Given
    const fixture = createAuthOAuthFixture(provider);
    fixture.identityProvider.profile.email = fixture.user.email;
    const existingSession = SessionFixture.create({ userId: fixture.user.id });
    fixture.sessionRepository.sessions.set(existingSession.id, existingSession);
    fixture.cacheService.sessionIds.add(existingSession.id);
    const currentUser = new GetCurrentUser(fixture);
    expect(
      (await currentUser.execute({ userId: fixture.user.id, sessionId: existingSession.id }))
        .providers,
    ).toEqual(["CREDENTIAL"]);
    // When
    const result = await new LoginWithOAuthToken(fixture).execute({
      provider,
      token: "token",
      metadata,
    });
    // Then
    expect(result.userId).toBe(fixture.user.id);
    expect(fixture.cacheService.profiles.has(fixture.user.id)).toBe(false);
    expect(
      await currentUser.execute({ userId: fixture.user.id, sessionId: existingSession.id }),
    ).toMatchObject({
      name: "사용자",
      sessionId: existingSession.id,
      providers: ["CREDENTIAL", provider],
    });
    expect(fixture.sessionRepository.sessions.get(existingSession.id)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(existingSession.id)).toBe(true);
    expect(
      await fixture.accountRepository.findByProviderAccountId(
        provider,
        fixture.identityProvider.profile.id,
      ),
    ).toMatchObject({ userId: fixture.user.id });
    expect(fixture.securityLogRepository.entries).toMatchObject([
      {
        event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
        metadata: { provider, autoLinked: true, reason: "trusted_provider_verified_email" },
      },
      { event: SECURITY_EVENT.LOGIN_SUCCESS },
    ]);
    expect(fixture.adminEventNotifier.notifications).toEqual([]);
    expect(fixture.retentionEnroller.enrollments).toEqual([]);
  });

  it.each([
    { provider: "GOOGLE", emailVerified: false, reason: "email_not_verified" },
    { provider: "APPLE", emailVerified: false, reason: "email_not_verified" },
    { provider: "KAKAO", emailVerified: true, reason: "untrusted_provider" },
    { provider: "NAVER", emailVerified: false, reason: "untrusted_provider" },
  ] satisfies Array<{
    provider: Parameters<LoginWithOAuthToken["execute"]>[0]["provider"];
    emailVerified: boolean;
    reason: string;
  }>)(
    "$provider / emailVerified=$emailVerified: 수동 연결 오류와 감사 사유를 반환한다",
    async ({ provider, emailVerified, reason }) => {
      // Given
      const fixture = createAuthOAuthFixture(provider);
      fixture.identityProvider.profile = {
        ...fixture.identityProvider.profile,
        email: fixture.user.email,
        emailVerified,
      };
      fixture.userRepository.users.set(fixture.user.id, { ...fixture.user, status: "LOCKED" });
      // When
      const pending = new LoginWithOAuthToken(fixture).execute({
        provider,
        token: "token",
        metadata,
      });
      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0206,
        details: {
          provider,
          providerAccountId: fixture.identityProvider.profile.id,
          email: fixture.user.email,
        },
      });
      expect(fixture.securityLogRepository.entries).toMatchObject([
        { event: SECURITY_EVENT.OAUTH_LINK_REQUIRED, metadata: { provider, reason } },
      ]);
      expect(fixture.accountRepository.accounts).toHaveLength(1);
      expect(fixture.sessionRepository.sessions.size).toBe(0);
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
    },
  );

  it.each(["LOCKED", "SUSPENDED"] satisfies Array<"LOCKED" | "SUSPENDED">)(
    "%s: 신뢰된 이메일도 로그인 상태가 허용되어야 자동 연결한다",
    async (status) => {
      // Given
      const fixture = createAuthOAuthFixture();
      fixture.identityProvider.profile.email = fixture.user.email;
      fixture.userRepository.users.set(fixture.user.id, { ...fixture.user, status });
      // When
      const pending = new LoginWithOAuthToken(fixture).execute({
        provider: "GOOGLE",
        token: "token",
      });
      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: status === "LOCKED" ? ErrorCode.USER_0607 : ErrorCode.USER_0605,
      });
      expect(fixture.accountRepository.accounts).toHaveLength(1);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it.each([true, false])(
    "기존 신원=%s: 유예기간의 탈퇴 계정을 복구하고 동일 판정 시각으로 경계 통과 요청을 완료한다",
    async (existingIdentity) => {
      // Given
      const fixture = existingIdentity ? givenExisting() : createAuthOAuthFixture();
      fixture.identityProvider.profile.email = fixture.user.email;
      const deletedAt = new Date(AUTH_CREDENTIAL_TIME.getTime() - 30 * 86_400_000 + 1);
      await fixture.userRepository.softDelete(fixture.user.id, deletedAt);
      fixture.cacheService.userIds.add(fixture.user.id);
      fixture.unitOfWork.run = async <T>(work: () => Promise<T>): Promise<T> => {
        vi.setSystemTime(AUTH_CREDENTIAL_TIME.getTime() + 2);
        return work();
      };
      // When
      const result = await new LoginWithOAuthToken(fixture).execute({
        provider: "GOOGLE",
        token: "token",
        metadata,
      });
      // Then
      expect(result.accountRestored).toBe(true);
      expect(fixture.userRepository.users.get(fixture.user.id)).toMatchObject({
        status: "ACTIVE",
        deletedAt: null,
      });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      expect(
        fixture.securityLogRepository.entries.some(
          (entry) => entry.event === SECURITY_EVENT.ACCOUNT_RESTORED,
        ),
      ).toBe(true);
      expect(fixture.sessionRepository.sessions.size).toBe(1);
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
    },
  );

  it("복구 시 최신 역할을 발급에 사용하면서 복구 감사의 원래 탈퇴 시각을 보존한다", async () => {
    // Given
    const fixture = givenExisting();
    const deletedAt = new Date(AUTH_CREDENTIAL_TIME.getTime() - 29 * 86_400_000);
    await fixture.userRepository.softDelete(fixture.user.id, deletedAt);
    const originalRead = fixture.userRepository.findById.bind(fixture.userRepository);
    let reads = 0;
    vi.spyOn(fixture.userRepository, "findById").mockImplementation(async (id) => {
      const user = await originalRead(id);
      if (user === null) return null;
      return ++reads === 1 ? user : { ...user, role: "ADMIN" };
    });
    // When
    await fixture.useCase.execute({ provider: "GOOGLE", token: "token", metadata });
    // Then
    expect(fixture.tokenService.issued[0]?.role).toBe("ADMIN");
    expect(
      fixture.securityLogRepository.entries.find(
        (entry) => entry.event === SECURITY_EVENT.ACCOUNT_RESTORED,
      )?.metadata,
    ).toMatchObject({ deletedAt: deletedAt.toISOString() });
  });

  it.each([true, false])(
    "기존 신원=%s: 유예기간이 지난 탈퇴 오류는 신원 연결·수동 연결 판정보다 우선한다",
    async (existingIdentity) => {
      // Given
      const fixture = createAuthOAuthFixture("KAKAO");
      fixture.identityProvider.profile.email = fixture.user.email;
      if (existingIdentity)
        fixture.accountRepository.accounts.push(
          AccountFixture.create({
            userId: fixture.user.id,
            provider: "KAKAO",
            providerAccountId: fixture.identityProvider.profile.id,
          }),
        );
      await fixture.userRepository.softDelete(
        fixture.user.id,
        new Date(AUTH_CREDENTIAL_TIME.getTime() - 31 * 86_400_000),
      );
      // When
      const pending = new LoginWithOAuthToken(fixture).execute({
        provider: "KAKAO",
        token: "token",
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0606 });
      expect(fixture.sessionRepository.sessions.size).toBe(0);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
    },
  );

  it.each([true, false])(
    "복구=%s: 자동 연결 저장 실패는 성공 캐시 무효화에 도달하지 않는다",
    async (restoring) => {
      // Given
      const fixture = createAuthOAuthFixture();
      fixture.identityProvider.profile.email = fixture.user.email;
      if (restoring)
        await fixture.userRepository.softDelete(
          fixture.user.id,
          new Date(AUTH_CREDENTIAL_TIME.getTime() - 29 * 86_400_000),
        );
      fixture.cacheService.userIds.add(fixture.user.id);
      const storageError = new Error("연결 저장 실패");
      vi.spyOn(fixture.accountRepository, "createOAuthAccount").mockRejectedValueOnce(storageError);
      // When
      const pending = new LoginWithOAuthToken(fixture).execute({
        provider: "GOOGLE",
        token: "token",
      });
      // Then
      await expect(pending).rejects.toBe(storageError);
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
      expect(fixture.loginAttemptRepository.attempts.filter((attempt) => !attempt.success)).toEqual(
        [],
      );
    },
  );

  it("미지원 제공자는 검증과 실패 시도 기록 전에 거부한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    // When
    const pending = new LoginWithOAuthToken(fixture).execute({ provider: "APPLE", token: "token" });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SOCIAL_0204,
      details: { provider: "APPLE", reason: "Unsupported provider: APPLE" },
    });
    expect(fixture.identityProvider.verifications).toEqual([]);
    expect(fixture.loginAttemptRepository.attempts).toEqual([]);
  });
});

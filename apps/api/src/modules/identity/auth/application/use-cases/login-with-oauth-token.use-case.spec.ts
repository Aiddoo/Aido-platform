import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AuthUserRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import {
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
  type AccountProvider,
  type UserStatus,
} from "#api/modules/identity/auth/domain/auth.constants";
import { IdentityUser } from "#api/modules/identity/users/domain/identity-user.aggregate";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";
import type { FixedClock } from "#test/doubles/platform/fixed-clock";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import {
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { GetCurrentUserUseCase } from "../../../users/application/use-cases/get-current-user.use-case.js";
import { LoginWithOAuthTokenUseCase } from "./login-with-oauth-token.use-case.js";

const providers = ["APPLE", "GOOGLE", "KAKAO", "NAVER"] satisfies Array<
  Parameters<LoginWithOAuthTokenUseCase["execute"]>[0]["provider"]
>;
const metadata = { ip: "192.0.2.40", userAgent: "소셜 로그인 기기" };

type OAuthFixture = ReturnType<typeof createAuthOAuthFixture>;

type LoginUserReader = Pick<
  AuthUserRepositoryPort,
  "findById" | "findByEmail" | "findByIdForUpdate"
>;

// 역할을 바꾸는 저장소 API가 없어, 정한 조회 차례부터 같은 사용자를 ADMIN으로 돌려준다
class PromotingUserRepository implements LoginUserReader {
  readonly #source: LoginUserReader;
  readonly #promoteFromRead: number;
  #reads = 0;

  constructor(source: LoginUserReader, promoteFromRead: number) {
    this.#source = source;
    this.#promoteFromRead = promoteFromRead;
  }

  async findById(id: UserId): Promise<IdentityUser | null> {
    const user = await this.#source.findById(id);
    this.#reads += 1;
    if (user == null || this.#reads < this.#promoteFromRead) {
      return user;
    }
    return IdentityUser.reconstitute({ ...user.toPrimitives(), role: "ADMIN" });
  }

  findByEmail(email: string): Promise<IdentityUser | null> {
    return this.#source.findByEmail(email);
  }

  findByIdForUpdate(id: UserId): Promise<IdentityUser | null> {
    return this.#source.findByIdForUpdate(id);
  }
}

// 트랜잭션을 열 때마다 시계를 넘겨, 판정 시각을 다시 읽으면 경계를 넘도록 만든다
class ClockAdvancingUnitOfWork extends UnitOfWorkPort {
  readonly #clock: FixedClock;
  readonly #step: Temporal.DurationLike;

  constructor(clock: FixedClock, step: Temporal.DurationLike) {
    super();
    this.#clock = clock;
    this.#step = step;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    this.#clock.advanceBy(this.#step);
    return work();
  }
}

// 탈퇴 유예 중 비활성 계정은 권한을 무료로 캐시한다
const FREE_ACCESS_WHILE_DELETED = { status: null, isAdmin: false, resourceBonuses: {} };

async function saveUserStatus(
  fixture: OAuthFixture,
  status: UserStatus,
  deletedAt: Temporal.Instant | null = null,
): Promise<void> {
  await fixture.userRepository.saveAccountStatus(
    createIdentityUserFixture({ ...fixture.user, status, deletedAt }),
  );
}

function daysBeforeNow(days: number): Temporal.Instant {
  return AUTH_CREDENTIAL_NOW.subtract({ hours: 24 * days });
}

describe("LoginWithOAuthToken — 공급자 인증과 사용자 생명주기", () => {
  async function linkExistingIdentity(fixture: OAuthFixture, provider: AccountProvider) {
    await fixture.accountRepository.createOAuthAccount({
      userId: UserId.reconstitute(fixture.user.id),
      provider,
      providerAccountId: fixture.identityProvider.profile.id,
    });
  }

  async function givenExisting(provider: AccountProvider = "GOOGLE") {
    const fixture = createAuthOAuthFixture(provider);
    await linkExistingIdentity(fixture, provider);
    return { ...fixture, useCase: new LoginWithOAuthTokenUseCase(fixture) };
  }

  it.each(providers)(
    "%s: 기존 신원을 우선 조회하고 저장된 이메일·역할로 세션을 발급한다",
    async (provider) => {
      // Given
      const fixture = await givenExisting(provider);
      await saveUserStatus(fixture, "PENDING_VERIFY");
      const useCase = new LoginWithOAuthTokenUseCase({
        ...fixture,
        userRepository: new PromotingUserRepository(fixture.userRepository, 1),
      });
      // When
      const result = await useCase.execute({
        provider,
        token: "token-secret",
        metadata,
        nonce: "apple-nonce",
      });
      // Then
      expect(result.userId).toBe(fixture.user.id);
      expect(result.name).toBe("사용자");
      expect(result.isNewUser).toBe(false);
      expect(result.sessionId).toBeTruthy();
      expect(fixture.tokenService.issued).toMatchObject([
        {
          userId: fixture.user.id,
          email: fixture.user.email,
          role: "ADMIN",
          sessionId: result.sessionId,
        },
      ]);
      expect(fixture.sessionRepository.stored(result.sessionId)).toMatchObject({
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
      expect(fixture.retentionEnroller.enrollments).toEqual([]);
      expect(JSON.stringify(fixture.logger.messages)).not.toContain("token-secret");
    },
  );

  it.each(providers)(
    "%s: 검증 실패만 실패 시도로 기록하고 사용자 상태를 변경하지 않는다",
    async (provider) => {
      // Given
      const fixture = await givenExisting(provider);
      const verificationError = new Error("검증 실패");
      fixture.identityProvider.verificationError = verificationError;
      // When
      const pending = fixture.useCase.execute({ provider, token: "token-secret" });
      // Then
      await expect(pending).rejects.toBe(verificationError);
      expect(fixture.loginAttemptRepository.attempts).toEqual([
        {
          email: fixture.identityProvider.failureEmail,
          provider,
          success: false,
          failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
          ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
          userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
          attemptedAt: AUTH_CREDENTIAL_NOW,
        },
      ]);
      expect(fixture.userRepository.all).toEqual([fixture.user]);
      expect(fixture.sessionRepository.all).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it.each(providers)(
    "%s: 신규 사용자의 필수 동의·프로필·리텐션을 저장하고 마케팅 동의를 만들지 않는다",
    async (provider) => {
      // Given
      const fixture = createAuthOAuthFixture(provider, { empty: true });
      const userName = "사용자가 직접 지정한 매우 긴 이름입니다";
      // When
      const result = await new LoginWithOAuthTokenUseCase(fixture).execute({
        provider,
        token: "token",
        userName,
        metadata,
      });
      // Then
      expect(result.isNewUser).toBe(true);
      const stored = fixture.userRepository.stored(result.userId);
      expect(stored).toMatchObject({
        email: fixture.identityProvider.profile.email,
        status: "ACTIVE",
      });
      expect(stored?.emailVerifiedAt).toEqual(AUTH_CREDENTIAL_NOW);
      expect(fixture.userRepository.profileOf(result.userId)).toEqual({
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
          consent: {
            termsAgreedAt: AUTH_CREDENTIAL_NOW,
            privacyAgreedAt: AUTH_CREDENTIAL_NOW,
            agreedTermsVersion: "1.0.0",
          },
        },
      ]);
      expect(fixture.seeder.categoryUserIds).toEqual([result.userId]);
      expect(fixture.retentionEnroller.enrollments).toEqual([
        { userId: result.userId, activated: true },
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
    const result = await new LoginWithOAuthTokenUseCase(fixture).execute({
      provider: "KAKAO",
      token: "token",
    });
    // Then
    expect(fixture.userRepository.stored(result.userId)?.email).toBe(
      "kakao_provider-account@social.aido.kr",
    );
    expect(result.name).toBe("소셜 사용자");
    expect(result.isNewUser).toBe(true);
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
      const fixture = await givenExisting();
      await saveUserStatus(fixture, status);
      // When
      const pending = fixture.useCase.execute({ provider: "GOOGLE", token: "token" });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
      expect(fixture.sessionRepository.all).toEqual([]);
    },
  );

  it("신원에 연결된 사용자가 없으면 USER_0601이고 신규 가입·실패 시도를 만들지 않는다", async () => {
    // Given
    const fixture = await givenExisting();
    await fixture.userRepository.hardDelete(UserId.reconstitute(fixture.user.id));
    // When
    const pending = fixture.useCase.execute({ provider: "GOOGLE", token: "token" });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0601,
      details: { userId: fixture.user.id },
    });
    expect(fixture.userRepository.all).toEqual([]);
    expect(fixture.loginAttemptRepository.attempts).toEqual([]);
  });

  it.each(["APPLE", "GOOGLE"] satisfies Array<
    Parameters<LoginWithOAuthTokenUseCase["execute"]>[0]["provider"]
  >)("%s: 검증된 동일 이메일은 기존 계정에 자동 연결하고 로그인한다", async (provider) => {
    // Given
    const fixture = createAuthOAuthFixture(provider);
    fixture.identityProvider.profile.email = fixture.user.email;
    const existingSession = createAuthSessionFixture({ userId: fixture.user.id });
    const sessionId = existingSession.id.value;
    await fixture.sessionRepository.save(existingSession);
    fixture.cacheService.sessionIds.add(sessionId);
    const currentUser = new GetCurrentUserUseCase(fixture);
    const before = await currentUser.execute({
      userId: fixture.user.id,
      sessionId,
      timezone: "Asia/Seoul",
    });
    // When
    const result = await new LoginWithOAuthTokenUseCase(fixture).execute({
      provider,
      token: "token",
      metadata,
    });
    // Then
    expect(before.providers).toEqual(["CREDENTIAL"]);
    expect(result.userId).toBe(fixture.user.id);
    expect(result.isNewUser).toBe(false);
    expect(fixture.cacheService.profiles.has(fixture.user.id)).toBe(false);
    expect(
      await currentUser.execute({ userId: fixture.user.id, sessionId, timezone: "Asia/Seoul" }),
    ).toMatchObject({ name: "사용자", sessionId, providers: ["CREDENTIAL", provider] });
    expect(fixture.sessionRepository.stored(sessionId)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
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
    expect(fixture.retentionEnroller.enrollments).toEqual([]);
  });

  it.each([
    { provider: "GOOGLE", emailVerified: false, reason: "email_not_verified" },
    { provider: "APPLE", emailVerified: false, reason: "email_not_verified" },
    { provider: "KAKAO", emailVerified: true, reason: "untrusted_provider" },
    { provider: "NAVER", emailVerified: false, reason: "untrusted_provider" },
  ] satisfies Array<{
    provider: Parameters<LoginWithOAuthTokenUseCase["execute"]>[0]["provider"];
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
      await saveUserStatus(fixture, "LOCKED");
      // When
      const pending = new LoginWithOAuthTokenUseCase(fixture).execute({
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
      expect(fixture.accountRepository.all).toHaveLength(1);
      expect(fixture.sessionRepository.all).toEqual([]);
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
    },
  );

  it.each(["LOCKED", "SUSPENDED"] satisfies Array<"LOCKED" | "SUSPENDED">)(
    "%s: 신뢰된 이메일도 로그인 상태가 허용되어야 자동 연결한다",
    async (status) => {
      // Given
      const fixture = createAuthOAuthFixture();
      fixture.identityProvider.profile.email = fixture.user.email;
      await saveUserStatus(fixture, status);
      // When
      const pending = new LoginWithOAuthTokenUseCase(fixture).execute({
        provider: "GOOGLE",
        token: "token",
      });
      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: status === "LOCKED" ? ErrorCode.USER_0607 : ErrorCode.USER_0605,
      });
      expect(fixture.accountRepository.all).toHaveLength(1);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it.each([true, false])(
    "기존 신원=%s: 유예기간의 탈퇴 계정을 복구하고 동일 판정 시각으로 경계 통과 요청을 완료한다",
    async (existingIdentity) => {
      // Given
      const fixture = createAuthOAuthFixture();
      if (existingIdentity) {
        await linkExistingIdentity(fixture, "GOOGLE");
      }
      fixture.identityProvider.profile.email = fixture.user.email;
      await saveUserStatus(fixture, "SUSPENDED", daysBeforeNow(30).add({ milliseconds: 1 }));
      fixture.cacheService.userIds.add(fixture.user.id);
      fixture.entitlementCache.entries.set(fixture.user.id, FREE_ACCESS_WHILE_DELETED);
      const unitOfWork = new ClockAdvancingUnitOfWork(fixture.clock, { milliseconds: 2 });
      // When
      const result = await new LoginWithOAuthTokenUseCase({ ...fixture, unitOfWork }).execute({
        provider: "GOOGLE",
        token: "token",
        metadata,
      });
      // Then
      expect(result.accountRestored).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(fixture.userRepository.stored(fixture.user.id)).toMatchObject({
        status: "ACTIVE",
        deletedAt: null,
      });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      expect(fixture.entitlementCache.entries.has(fixture.user.id)).toBe(false);
      expect(
        fixture.securityLogRepository.entries.some(
          (entry) => entry.event === SECURITY_EVENT.ACCOUNT_RESTORED,
        ),
      ).toBe(true);
      expect(fixture.sessionRepository.all).toHaveLength(1);
    },
  );

  it("복구 시 최신 역할을 발급에 사용하면서 복구 감사의 원래 탈퇴 시각을 보존한다", async () => {
    // Given
    const fixture = await givenExisting();
    const deletedAt = daysBeforeNow(29);
    await saveUserStatus(fixture, "SUSPENDED", deletedAt);
    const useCase = new LoginWithOAuthTokenUseCase({
      ...fixture,
      userRepository: new PromotingUserRepository(fixture.userRepository, 2),
    });
    // When
    await useCase.execute({ provider: "GOOGLE", token: "token", metadata });
    // Then
    expect(fixture.tokenService.issued[0]?.role).toBe("ADMIN");
    expect(
      fixture.securityLogRepository.entries.find(
        (entry) => entry.event === SECURITY_EVENT.ACCOUNT_RESTORED,
      )?.metadata,
    ).toMatchObject({ deletedAt: toIsoString(deletedAt) });
  });

  it.each([true, false])(
    "기존 신원=%s: 유예기간이 지난 탈퇴 오류는 신원 연결·수동 연결 판정보다 우선한다",
    async (existingIdentity) => {
      // Given
      const fixture = createAuthOAuthFixture("KAKAO");
      fixture.identityProvider.profile.email = fixture.user.email;
      if (existingIdentity) {
        await linkExistingIdentity(fixture, "KAKAO");
      }
      await saveUserStatus(fixture, "SUSPENDED", daysBeforeNow(31));
      // When
      const pending = new LoginWithOAuthTokenUseCase(fixture).execute({
        provider: "KAKAO",
        token: "token",
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0606 });
      expect(fixture.sessionRepository.all).toEqual([]);
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
      if (restoring) {
        await saveUserStatus(fixture, "SUSPENDED", daysBeforeNow(29));
      }
      fixture.cacheService.userIds.add(fixture.user.id);
      const storageError = new Error("연결 저장 실패");
      const useCase = new LoginWithOAuthTokenUseCase({
        ...fixture,
        accountRepository: {
          findByProviderAccountId: async () => null,
          createOAuthAccount: async () => {
            throw storageError;
          },
        },
      });
      // When
      const pending = useCase.execute({ provider: "GOOGLE", token: "token" });
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
    const pending = new LoginWithOAuthTokenUseCase(fixture).execute({
      provider: "APPLE",
      token: "token",
    });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SOCIAL_0204,
      details: { provider: "APPLE", reason: "Unsupported provider: APPLE" },
    });
    expect(fixture.identityProvider.verifications).toEqual([]);
    expect(fixture.loginAttemptRepository.attempts).toEqual([]);
  });
});

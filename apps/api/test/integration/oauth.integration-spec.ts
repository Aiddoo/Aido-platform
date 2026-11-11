import { ErrorCode } from "@aido/api/errors";
import { HttpClient } from "@nestjs/http-client";
import type { TestingModule } from "@nestjs/testing";
import { count, eq } from "drizzle-orm";
import { vi } from "vitest";

import type { OAuthIdentityProviderPort } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { ExchangeOAuthCodeUseCase } from "#api/modules/identity/auth/application/use-cases/exchange-oauth-code.use-case";
import { GetOAuthRedirectUriUseCase } from "#api/modules/identity/auth/application/use-cases/get-oauth-redirect-uri.use-case";
import { LinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/link-oauth-account.use-case";
import { ListLinkedAccountsUseCase } from "#api/modules/identity/auth/application/use-cases/list-linked-accounts.use-case";
import { LoginWithOAuthTokenUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-oauth-token.use-case";
import { UnlinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/unlink-oauth-account.use-case";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import { AppleOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/apple-oauth-identity.adapter";
import { GoogleOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/google-oauth-identity.adapter";
import { KakaoOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/kakao-oauth-identity.adapter";
import { NaverOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/naver-oauth-identity.adapter";
import { DrizzleOAuthStateRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-oauth-state.repository";
import { requireRecord } from "#api/platform/database/database-error.util";
import { session as sessionTable, user as userTable } from "#api/platform/database/schema/index";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ApplicationException } from "#api/shared/application/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import { FakeOAuthProviderRegistry } from "#test/mocks/fake-oauth-provider-registry";
import { FakeOAuthTokenVerifierService } from "#test/mocks/fake-oauth-token-verifier.service";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

type SocialProvider = Exclude<AccountProvider, "CREDENTIAL">;
const profileProviders = {
  APPLE: "apple",
  GOOGLE: "google",
  KAKAO: "kakao",
  NAVER: "naver",
} satisfies Record<
  SocialProvider,
  Parameters<FakeOAuthTokenVerifierService["setCustomProfile"]>[0]
>;
const at = new Date("2026-10-07T12:00:00.000Z");

describe("OAuth UseCase 통합 테스트 (실제 PostgreSQL)", () => {
  let module: TestingModule;
  let loginWithOAuthToken: LoginWithOAuthTokenUseCase;
  let linkOAuthAccount: LinkOAuthAccountUseCase;
  let unlinkOAuthAccount: UnlinkOAuthAccountUseCase;
  let listLinkedAccounts: ListLinkedAccountsUseCase;
  let getOAuthRedirectUri: GetOAuthRedirectUriUseCase;
  let exchangeOAuthCode: ExchangeOAuthCodeUseCase;
  let fakeTokenVerifier: FakeOAuthTokenVerifierService;
  let testDb: TestDatabase;
  let client: TestDatabaseClient;
  let oauthStateRepository: DrizzleOAuthStateRepository;

  beforeAll(async () => {
    testDb = new TestDatabase();
    client = await testDb.start();
    fakeTokenVerifier = new FakeOAuthTokenVerifierService();
    const oauthClient = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      callbackUrl: "http://localhost:3000/auth/callback",
      isConfigured: true,
    };
    const config = {
      google: oauthClient,
      kakao: oauthClient,
      naver: oauthClient,
      apple: { clientId: undefined, jwksUrl: undefined, jwksCooldownDurationMs: undefined },
    };
    const http = new HttpClient({ retry: false, throwOnHttpError: false });
    const policies = new OutboundPolicyRegistry(new RecordingOperationalAlert());
    const registry = new FakeOAuthProviderRegistry(
      new Map<AccountProvider, OAuthIdentityProviderPort>([
        ["APPLE", new AppleOAuthIdentityAdapter(config)],
        ["GOOGLE", new GoogleOAuthIdentityAdapter(config, http, policies)],
        ["KAKAO", new KakaoOAuthIdentityAdapter(config, http, policies)],
        ["NAVER", new NaverOAuthIdentityAdapter(config, http, policies)],
      ]),
      fakeTokenVerifier,
    ).registry;
    module = await createAuthTestModule(testDb.getClient(), new FakeEmailService(), {
      oauthProviderRegistry: registry,
    });
    loginWithOAuthToken = module.get(LoginWithOAuthTokenUseCase);
    linkOAuthAccount = module.get(LinkOAuthAccountUseCase);
    unlinkOAuthAccount = module.get(UnlinkOAuthAccountUseCase);
    listLinkedAccounts = module.get(ListLinkedAccountsUseCase);
    getOAuthRedirectUri = module.get(GetOAuthRedirectUriUseCase);
    exchangeOAuthCode = module.get(ExchangeOAuthCodeUseCase);
    oauthStateRepository = module.get(DrizzleOAuthStateRepository);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    suppressLogger();
    await testDb.cleanup();
    fakeTokenVerifier.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      await testDb?.stop();
    }
  });

  function givenOAuthToken(provider: SocialProvider, providerAccountId: string): string {
    const token = `link:${provider}:${providerAccountId}`;
    fakeTokenVerifier.setCustomProfile(profileProviders[provider], token, {
      id: providerAccountId,
      emailVerified: true,
    });
    return token;
  }

  describe("Google OAuth 모바일 로그인", () => {
    const testGoogleToken = "test-google-id-token-12345";

    it("첫 Google 로그인 시 새 사용자를 생성해야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("google", testGoogleToken, {
        id: "google-user-123",
        email: "google-user@example.com",
        emailVerified: true,
        name: "Google User",
        picture: "https://example.com/avatar.jpg",
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: testGoogleToken,
        metadata: {
          ip: "127.0.0.1",
          userAgent: "TestAgent",
        },
      });

      // Then
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.name).toBe("Google User");
      expect(result.profileImage).toBe("https://example.com/avatar.jpg");

      const user = await client.query.user.findFirst({
        where: { id: result.userId },
        with: { accounts: true, profile: true },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe("google-user@example.com");
      expect(user?.status).toBe("ACTIVE"); // emailVerified가 true이므로 ACTIVE
      expect(user?.accounts).toHaveLength(1);
      expect(user?.accounts[0]?.provider).toBe("GOOGLE");
      expect(user?.accounts[0]?.providerAccountId).toBe("google-user-123");
      expect(user?.profile?.name).toBe("Google User");
    });

    it("기존 사용자가 다시 Google 로그인하면 동일한 계정으로 로그인되어야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("google", testGoogleToken, {
        id: "google-returning-user",
        email: "returning@example.com",
        emailVerified: true,
        name: "Returning User",
      });

      const firstLogin = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: testGoogleToken,
      });
      const userId = firstLogin.userId;

      // When
      const secondLogin = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: testGoogleToken,
      });

      // Then
      expect(secondLogin.userId).toBe(userId);
      expect(secondLogin.tokens.accessToken).toBeDefined();

      const users = await client.query.user.findMany({ where: { email: "returning@example.com" } });
      expect(users).toHaveLength(1);
    });

    it("Google 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
      // Given
      fakeTokenVerifier.simulateFailure();

      // When
      const outcome = loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: "invalid-token",
        metadata: {
          ip: "192.168.1.1",
          userAgent: "FailTestAgent",
        },
      });

      // Then
      await expect(outcome).rejects.toThrow();

      const attempts = await client.query.loginAttempt.findMany({
        where: { email: "google_unknown@social.aido.kr" },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.success).toBe(false);
      expect(attempts[0]?.ipAddress).toBe("192.168.1.1");
      expect(attempts[0]?.failureReason).toBe("OAUTH_TOKEN_INVALID");
    });
  });

  describe("Naver OAuth 모바일 로그인", () => {
    const testNaverToken = "test-naver-access-token-12345";

    it("첫 Naver 로그인 시 새 사용자를 생성해야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("naver", testNaverToken, {
        id: "naver-user-456",
        email: "naver-user@example.com",
        emailVerified: true,
        name: "Naver User",
        picture: "https://example.com/naver-avatar.jpg",
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "NAVER",
        token: testNaverToken,
        metadata: {
          ip: "127.0.0.1",
          userAgent: "TestAgent",
        },
      });

      // Then
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.name).toBe("Naver User");

      const user = await client.query.user.findFirst({
        where: { id: result.userId },
        with: { accounts: true },
      });
      expect(user).toBeDefined();
      expect(user?.accounts[0]?.provider).toBe("NAVER");
      expect(user?.accounts[0]?.providerAccountId).toBe("naver-user-456");
    });

    it("기존 사용자가 다시 Naver 로그인하면 동일한 계정으로 로그인되어야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("naver", testNaverToken, {
        id: "naver-returning",
        email: "naver-returning@example.com",
        emailVerified: true,
        name: "Naver Return",
      });

      const firstLogin = await loginWithOAuthToken.execute({
        provider: "NAVER",
        token: testNaverToken,
      });

      // When
      const secondLogin = await loginWithOAuthToken.execute({
        provider: "NAVER",
        token: testNaverToken,
      });

      // Then
      expect(secondLogin.userId).toBe(firstLogin.userId);
    });

    it("Naver 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
      // Given
      fakeTokenVerifier.simulateFailure();

      // When
      const outcome = loginWithOAuthToken.execute({
        provider: "NAVER",
        token: "invalid-naver-token",
        metadata: {
          ip: "10.0.0.1",
          userAgent: "NaverFailTest",
        },
      });

      // Then
      await expect(outcome).rejects.toThrow();

      const attempts = await client.query.loginAttempt.findMany({
        where: { email: "naver_unknown@social.aido.kr" },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.success).toBe(false);
    });
  });

  describe("Kakao OAuth 모바일 로그인", () => {
    const testKakaoToken = "test-kakao-access-token-789";

    it("첫 Kakao 로그인 시 새 사용자를 생성해야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("kakao", testKakaoToken, {
        id: "kakao-user-789",
        email: "kakao-user@example.com",
        emailVerified: false,
        name: "Kakao User",
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "KAKAO",
        token: testKakaoToken,
      });

      // Then
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.name).toBe("Kakao User");

      const user = await client.query.user.findFirst({ where: { id: result.userId } });
      expect(user?.status).toBe("ACTIVE");
    });

    it("Kakao 로그인 시 이메일이 없어도 처리할 수 있어야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("kakao", testKakaoToken, {
        id: "kakao-no-email",
        email: undefined,
        emailVerified: false,
        name: "Kakao NoEmail",
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "KAKAO",
        token: testKakaoToken,
      });

      // Then
      const user = await client.query.user.findFirst({ where: { id: result.userId } });
      expect(user?.email).toMatch(/^kakao_kakao-no-email@social\.aido\.kr$/);
    });
  });

  describe("Apple OAuth 모바일 로그인", () => {
    const testAppleToken = "test-apple-id-token-abc";

    it("첫 Apple 로그인 시 새 사용자를 생성해야 한다", async () => {
      // Given
      fakeTokenVerifier.setCustomProfile("apple", testAppleToken, {
        id: "apple-user-abc",
        email: "apple-user@privaterelay.appleid.com",
        emailVerified: true,
        name: undefined, // Apple은 이름이 첫 로그인에만 제공될 수 있음
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "APPLE",
        token: testAppleToken,
        userName: "Apple User",
      });

      // Then
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();

      const user = await client.query.user.findFirst({
        where: { id: result.userId },
        with: { accounts: true, profile: true },
      });
      expect(user?.accounts[0]?.provider).toBe("APPLE");
      expect(user?.profile?.name).toBe("Apple User");
    });
  });

  describe("계정 연결/해제", () => {
    let testUserId: string;

    beforeEach(async () => {
      const googleToken = "link-test-google-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "link-test-google-id",
        email: "link-test@example.com",
        emailVerified: true,
        name: "Link Test User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken });
      testUserId = result.userId;
    });

    it("기존 사용자에게 추가 소셜 계정을 연결할 수 있어야 한다", async () => {
      // When
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "naver-link-id"),
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");

      const accounts = await client.query.account.findMany({ where: { userId: testUserId } });
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.provider)).toContain("GOOGLE");
      expect(accounts.map((a) => a.provider)).toContain("NAVER");
    });

    it("이미 연결된 계정을 다시 연결하면 안내 메시지를 반환해야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "existing-naver-id"),
      });

      // When
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "existing-naver-id"),
      });

      // Then
      expect(result.message).toBe("이미 연결된 계정입니다.");
    });

    it("여러 계정이 연결된 상태에서 소셜 계정을 해제할 수 있어야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "unlink-naver-id"),
      });

      // When
      const result = await unlinkOAuthAccount.execute({ userId: testUserId, provider: "NAVER" });

      // Then
      expect(result.message).toBe("계정 연결이 해제되었습니다.");

      const accounts = await client.query.account.findMany({ where: { userId: testUserId } });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.provider).toBe("GOOGLE");
    });

    it("마지막 계정을 해제하려고 하면 에러를 발생시켜야 한다", async () => {
      // When
      const outcome = unlinkOAuthAccount.execute({ userId: testUserId, provider: "GOOGLE" });

      // Then
      await expect(outcome).rejects.toMatchObject({
        errorCode: ErrorCode.USER_0610,
        message: "마지막 로그인 수단은 해제할 수 없습니다.",
      });
    });

    it("연결된 계정 목록을 조회할 수 있어야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-link-id"),
      });
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "APPLE",
        accessToken: givenOAuthToken("APPLE", "apple-link-id"),
      });

      // When
      const linkedAccounts = await listLinkedAccounts.execute({ userId: testUserId });

      // Then
      expect(linkedAccounts.accounts).toHaveLength(4);
      const linkedProviders = linkedAccounts.accounts
        .filter((a) => a.linked)
        .map((a) => a.provider);
      expect(linkedProviders).toHaveLength(3);
      expect(linkedProviders).toContain("GOOGLE");
      expect(linkedProviders).toContain("KAKAO");
      expect(linkedProviders).toContain("APPLE");
    });
  });

  describe("계정 연동 심화", () => {
    let testUserId: string;

    beforeEach(async () => {
      const googleToken = "advanced-link-google-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "advanced-link-google-id",
        email: "advanced-link@example.com",
        emailVerified: true,
        name: "Advanced Link User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken });
      testUserId = result.userId;
    });

    it("해제 후 재연동 (round-trip)이 정상 동작해야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-roundtrip-id"),
      });

      let result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(true);

      // When
      await unlinkOAuthAccount.execute({ userId: testUserId, provider: "KAKAO" });

      result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(false);

      // When
      const linkResult = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-roundtrip-id"),
      });

      // Then
      expect(linkResult.message).toBe("계정이 연결되었습니다.");
      result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(true);
    });

    it("4개 provider 모두 같은 유저에 연동할 수 있어야 한다", async () => {
      // Given

      // When
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "APPLE",
        accessToken: givenOAuthToken("APPLE", "apple-multi-id"),
      });
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-multi-id"),
      });
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "naver-multi-id"),
      });

      // Then
      const { accounts } = await listLinkedAccounts.execute({ userId: testUserId });
      expect(accounts).toHaveLength(4);
      expect(accounts.every((a) => a.linked)).toBe(true);
    });

    it("linkAccount 시 SecurityLog(OAUTH_LINKED)가 기록되어야 한다", async () => {
      // When
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "APPLE",
        accessToken: givenOAuthToken("APPLE", "apple-seclog-id"),
        metadata: {
          ip: "10.0.0.1",
          userAgent: "SecurityLogTest/1.0",
        },
      });

      // Then
      const logs = await client.query.securityLog.findMany({
        where: { userId: testUserId, event: "OAUTH_LINKED" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("10.0.0.1");
      expect(logs[0]?.userAgent).toBe("SecurityLogTest/1.0");
      expect(logs[0]?.metadata).toMatchObject({
        provider: "APPLE",
        providerAccountId: "apple-seclog-id",
      });
    });

    it("unlinkAccount 시 SecurityLog(OAUTH_UNLINKED)가 기록되어야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-seclog-id"),
      });

      // When
      await unlinkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        metadata: {
          ip: "192.168.1.100",
          userAgent: "UnlinkTest/2.0",
        },
      });

      // Then
      const logs = await client.query.securityLog.findMany({
        where: { userId: testUserId, event: "OAUTH_UNLINKED" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("192.168.1.100");
      expect(logs[0]?.userAgent).toBe("UnlinkTest/2.0");
      expect(logs[0]?.metadata).toMatchObject({
        provider: "KAKAO",
      });
    });

    it("getLinkedAccounts가 providerAccountId를 반환해야 한다", async () => {
      // Given
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "naver-pid-test"),
      });

      // When
      const { accounts } = await listLinkedAccounts.execute({ userId: testUserId });

      // Then
      const naverAccount = accounts.find((a) => a.provider === "NAVER");
      expect(naverAccount).toBeDefined();
      expect(naverAccount?.linked).toBe(true);
      expect(naverAccount?.providerAccountId).toBe("naver-pid-test");
      expect(naverAccount?.linkedAt).toBeInstanceOf(Temporal.Instant);
    });

    it("다른 유저에 연결된 계정을 연동하면 409 에러가 발생해야 한다", async () => {
      // Given
      const otherToken = "other-user-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", otherToken, {
        id: "conflict-apple-id",
        email: "other-apple@example.com",
        emailVerified: true,
        name: "Other Apple User",
      });

      await loginWithOAuthToken.execute({ provider: "APPLE", token: otherToken });

      // When
      const outcome = linkOAuthAccount.execute({
        userId: testUserId,
        provider: "APPLE",
        accessToken: givenOAuthToken("APPLE", "conflict-apple-id"),
      });

      // Then
      await expect(outcome).rejects.toThrow(ApplicationException);
    });
  });

  async function createState(state: string, provider: AccountProvider, redirectUri: string) {
    // use case의 DateClock과 같은 시계로 만료를 정한다
    const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
    await oauthStateRepository.create({
      state,
      provider,
      redirectUri,
      expiresAt: now.add({ minutes: 10 }),
    });
    const created = await oauthStateRepository.findByState(state, now);
    if (created == null) {
      throw new Error(`OAuth state가 만들어지지 않았습니다: ${state}`);
    }
    return created;
  }

  describe("OAuth State 및 Exchange Code", () => {
    it("저장된 state로 redirectUri를 조회할 수 있어야 한다", async () => {
      // Given
      const state = "redirect-lookup-state";
      const redirectUri = "aido-dev://auth/naver";

      await createState(state, "NAVER", redirectUri);

      // When
      const resolved = await getOAuthRedirectUri.execute({ state: state });

      // Then
      expect(resolved).toBe(redirectUri);
    });

    it("없는 state 조회 시 null을 반환해야 한다", async () => {
      // When
      const resolved = await getOAuthRedirectUri.execute({ state: "missing-redirect-state" });

      // Then
      expect(resolved).toBeNull();
    });

    it("리다이렉트 URI와 함께 OAuth State를 생성할 수 있어야 한다", async () => {
      // Given
      const state = "test-csrf-state-123";
      const redirectUri = "aido://auth/callback";

      // When
      const oauthState = await createState(state, "KAKAO", redirectUri);

      // Then
      expect(oauthState.state).toBe(state);
      expect(oauthState.provider).toBe("KAKAO");
      expect(oauthState.redirectUri).toBe(redirectUri);
    });

    it("교환 코드로 토큰을 교환할 수 있어야 한다", async () => {
      // Given
      const googleToken = "exchange-test-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "exchange-test-user",
        email: "exchange@example.com",
        emailVerified: true,
        name: "Exchange Test",
      });

      const loginResult = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: googleToken,
      });

      const state = "exchange-state-456";
      const oauthState = await createState(state, "GOOGLE", "aido://auth/callback");

      const exchangeCode = oauthStateRepository.generateExchangeCode();
      await oauthStateRepository.saveExchangeData(oauthState.id, {
        exchangeCode,
        ...loginResult.tokens,
        userId: loginResult.userId,
        userName: loginResult.name ?? undefined,
        isNewUser: loginResult.isNewUser,
      });

      expect(exchangeCode).toBeDefined();

      // When
      const exchangeResult = await exchangeOAuthCode.execute({ code: exchangeCode });

      // Then
      expect(exchangeResult.accessToken).toBe(loginResult.tokens.accessToken);
      expect(exchangeResult.refreshToken).toBe(loginResult.tokens.refreshToken);
      expect(exchangeResult.userId).toBe(loginResult.userId);
      expect(exchangeResult.isNewUser).toBe(true);
    });

    it("유효하지 않은 교환 코드는 거부해야 한다", async () => {
      // When
      const outcome = exchangeOAuthCode.execute({ code: "invalid-exchange-code" });

      // Then
      await expect(outcome).rejects.toThrow(ApplicationException);
    });

    it("이미 사용된 교환 코드는 거부해야 한다", async () => {
      // Given
      const googleToken = "reuse-test-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "reuse-test-user",
        email: "reuse@example.com",
        emailVerified: true,
        name: "Reuse Test",
      });

      const loginResult = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: googleToken,
      });

      const oauthState = await createState("reuse-state", "GOOGLE", "aido://auth/callback");

      const exchangeCode = oauthStateRepository.generateExchangeCode();
      await oauthStateRepository.saveExchangeData(oauthState.id, {
        exchangeCode,
        ...loginResult.tokens,
        userId: loginResult.userId,
        isNewUser: loginResult.isNewUser,
      });

      await exchangeOAuthCode.execute({ code: exchangeCode });

      // When
      const outcome = exchangeOAuthCode.execute({ code: exchangeCode });

      // Then
      await expect(outcome).rejects.toThrow(ApplicationException);
    });
  });

  describe("보안 로그 및 세션", () => {
    it("로그인 성공 시 보안 로그를 생성해야 한다", async () => {
      // Given
      const token = "security-log-test-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "security-log-user",
        email: "security@example.com",
        emailVerified: true,
        name: "Security Test",
      });

      // When
      const result = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: token,
        metadata: {
          ip: "203.0.113.1",
          userAgent: "SecurityTestAgent/1.0",
        },
      });

      // Then
      const logs = await client.query.securityLog.findMany({ where: { userId: result.userId } });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      const loginLog = logs.find((l) => l.event === "LOGIN_SUCCESS");
      expect(loginLog).toBeDefined();
      expect(loginLog?.ipAddress).toBe("203.0.113.1");
    });

    it("로그인 시 세션을 생성해야 한다", async () => {
      // Given
      const token = "session-test-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "session-test-user",
        email: "session@example.com",
        emailVerified: true,
        name: "Session Test",
      });

      // When
      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // Then
      const session = await client.query.session.findFirst({ where: { id: result.sessionId } });

      expect(session).toBeDefined();
      expect(session?.userId).toBe(result.userId);
      expect(session?.refreshTokenHash).toBeDefined();
    });
  });

  describe("토큰 검증과 소셜 계정 연결", () => {
    let testUserId: string;

    beforeEach(async () => {
      const googleToken = "base-user-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "base-user-id",
        email: "base-user@example.com",
        emailVerified: true,
        name: "Base User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken });
      testUserId = result.userId;
    });

    it("토큰 검증을 통해 소셜 계정을 연결할 수 있어야 한다", async () => {
      // Given
      const kakaoToken = "link-with-token-kakao";
      fakeTokenVerifier.setCustomProfile("kakao", kakaoToken, {
        id: "kakao-to-link",
        email: "kakao-link@example.com",
        emailVerified: false,
        name: "Kakao Link",
      });

      // When
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: kakaoToken,
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");

      const accounts = await client.query.account.findMany({ where: { userId: testUserId } });
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.provider)).toContain("KAKAO");
    });

    it("Naver 계정을 토큰 검증을 통해 연결할 수 있어야 한다", async () => {
      // Given
      const naverToken = "link-naver-token";
      fakeTokenVerifier.setCustomProfile("naver", naverToken, {
        id: "naver-to-link",
        email: "naver@example.com",
        emailVerified: true,
        name: "Naver Link",
      });

      // When
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: naverToken,
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");
    });
  });

  describe("Provider별 자동/강제 연동", () => {
    describe("Google (신뢰된 Provider) 자동 연동", () => {
      it("기존 사용자의 이메일로 Google 로그인 시 자동 연동되어야 한다", async () => {
        // Given
        const appleToken = "existing-apple-user-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "existing-apple-id",
          email: "shared-email@example.com",
          emailVerified: true,
          name: "Existing Apple User",
        });

        const appleResult = await loginWithOAuthToken.execute({
          provider: "APPLE",
          token: appleToken,
        });
        const existingUserId = appleResult.userId;

        // When
        const googleToken = "new-google-login-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "new-google-id",
          email: "shared-email@example.com",
          emailVerified: true,
          name: "Google User Same Email",
        });

        const googleResult = await loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: googleToken,
          metadata: {
            ip: "127.0.0.1",
            userAgent: "TestAgent",
          },
        });

        // Then
        expect(googleResult.userId).toBe(existingUserId);

        const accounts = await client.query.account.findMany({ where: { userId: existingUserId } });
        expect(accounts).toHaveLength(2);
        expect(accounts.map((a) => a.provider).sort()).toEqual(["APPLE", "GOOGLE"]);

        const logs = await client.query.securityLog.findMany({
          where: { userId: existingUserId, event: "OAUTH_AUTO_LINKED" },
        });
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "GOOGLE",
          autoLinked: true,
        });
      });

      it("자동 연동 후 정상적으로 토큰이 발급되어야 한다", async () => {
        // Given
        const firstGoogleToken = "first-google-token";
        fakeTokenVerifier.setCustomProfile("google", firstGoogleToken, {
          id: "first-google-id",
          email: "token-test@example.com",
          emailVerified: true,
          name: "First Google User",
        });

        const firstResult = await loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: firstGoogleToken,
        });

        // When
        const appleToken = "link-apple-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "link-apple-id",
          email: "token-test@example.com",
          emailVerified: true,
          name: "Apple Same Email",
        });

        const appleResult = await loginWithOAuthToken.execute({
          provider: "APPLE",
          token: appleToken,
          metadata: {
            ip: "10.0.0.1",
            userAgent: "AppleTest",
          },
        });

        // Then
        expect(appleResult.tokens.accessToken).toBeDefined();
        expect(appleResult.tokens.refreshToken).toBeDefined();
        expect(appleResult.sessionId).toBeDefined();

        const session = await client.query.session.findFirst({
          where: { id: appleResult.sessionId },
        });
        expect(session).toBeDefined();
        expect(session?.userId).toBe(firstResult.userId);
      });
    });

    describe("Apple (신뢰된 Provider) 자동 연동", () => {
      it("기존 사용자의 이메일로 Apple 로그인 시 자동 연동되어야 한다", async () => {
        // Given
        const googleToken = "existing-google-user-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "existing-google-id",
          email: "apple-test@example.com",
          emailVerified: true,
          name: "Existing Google User",
        });

        const googleResult = await loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: googleToken,
        });
        const existingUserId = googleResult.userId;

        // When
        const appleToken = "new-apple-login-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "new-apple-id",
          email: "apple-test@example.com",
          emailVerified: true,
          name: "Apple User Same Email",
        });

        const appleResult = await loginWithOAuthToken.execute({
          provider: "APPLE",
          token: appleToken,
          userName: "Apple User",
          metadata: {
            ip: "192.168.1.1",
            userAgent: "AppleTestAgent",
          },
        });

        // Then
        expect(appleResult.userId).toBe(existingUserId);

        const logs = await client.query.securityLog.findMany({
          where: { userId: existingUserId, event: "OAUTH_AUTO_LINKED" },
        });
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "APPLE",
          autoLinked: true,
        });
      });
    });

    describe("Kakao (신뢰되지 않은 Provider) 강제 연동", () => {
      it("기존 사용자의 이메일로 Kakao 로그인 시 에러를 발생시켜야 한다", async () => {
        // Given
        const googleToken = "kakao-conflict-google-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "kakao-conflict-google-id",
          email: "kakao-conflict@example.com",
          emailVerified: true,
          name: "Google User",
        });

        const googleResult = await loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: googleToken,
        });
        const existingUserId = googleResult.userId;

        // When
        const kakaoToken = "conflicting-kakao-token";
        fakeTokenVerifier.setCustomProfile("kakao", kakaoToken, {
          id: "conflicting-kakao-id",
          email: "kakao-conflict@example.com",
          emailVerified: true,
          name: "Kakao User Same Email",
        });

        // Then
        await expect(
          loginWithOAuthToken.execute({
            provider: "KAKAO",
            token: kakaoToken,
            metadata: {
              ip: "172.16.0.1",
              userAgent: "KakaoTestAgent",
            },
          }),
        ).rejects.toThrow(ApplicationException);

        const logs = await client.query.securityLog.findMany({
          where: { userId: existingUserId, event: "OAUTH_LINK_REQUIRED" },
        });
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "KAKAO",
          reason: "untrusted_provider",
        });

        const accounts = await client.query.account.findMany({ where: { userId: existingUserId } });
        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.provider).toBe("GOOGLE");
      });
    });

    describe("Naver (신뢰되지 않은 Provider) 강제 연동", () => {
      it("기존 사용자의 이메일로 Naver 로그인 시 에러를 발생시켜야 한다", async () => {
        // Given
        const appleToken = "naver-conflict-apple-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "naver-conflict-apple-id",
          email: "naver-conflict@example.com",
          emailVerified: true,
          name: "Apple User",
        });

        const appleResult = await loginWithOAuthToken.execute({
          provider: "APPLE",
          token: appleToken,
        });
        const existingUserId = appleResult.userId;

        // When
        const naverToken = "conflicting-naver-token";
        fakeTokenVerifier.setCustomProfile("naver", naverToken, {
          id: "conflicting-naver-id",
          email: "naver-conflict@example.com",
          emailVerified: true,
          name: "Naver User Same Email",
        });

        // Then
        await expect(
          loginWithOAuthToken.execute({
            provider: "NAVER",
            token: naverToken,
            metadata: {
              ip: "172.16.0.2",
              userAgent: "NaverTestAgent",
            },
          }),
        ).rejects.toThrow(ApplicationException);

        const logs = await client.query.securityLog.findMany({
          where: { userId: existingUserId, event: "OAUTH_LINK_REQUIRED" },
        });
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "NAVER",
          reason: "untrusted_provider",
        });
      });
    });

    describe("잠긴/정지된 사용자 자동 연동 불가", () => {
      it("잠긴 사용자에게 자동 연동을 시도하면 에러가 발생해야 한다", async () => {
        // Given
        const googleToken = "locked-auto-link-google-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "locked-google-id",
          email: "locked-user@example.com",
          emailVerified: true,
          name: "Locked User",
        });

        const result = await loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: googleToken,
        });

        requireRecord(
          (
            await client
              .update(userTable)
              .set({ status: "LOCKED" })
              .where(eq(userTable.id, result.userId))
              .returning({ id: userTable.id })
          )[0],
        );

        // When
        const appleToken = "apple-to-locked-user-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "apple-to-locked-id",
          email: "locked-user@example.com",
          emailVerified: true,
          name: "Apple to Locked",
        });

        // Then
        await expect(
          loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken }),
        ).rejects.toThrow(DomainException);
      });

      it("정지된 사용자에게 자동 연동을 시도하면 에러가 발생해야 한다", async () => {
        // Given
        const appleToken = "suspended-auto-link-apple-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "suspended-apple-id",
          email: "suspended-user@example.com",
          emailVerified: true,
          name: "Suspended User",
        });

        const result = await loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken });

        requireRecord(
          (
            await client
              .update(userTable)
              .set({ status: "SUSPENDED" })
              .where(eq(userTable.id, result.userId))
              .returning({ id: userTable.id })
          )[0],
        );

        // When
        const googleToken = "google-to-suspended-user-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "google-to-suspended-id",
          email: "suspended-user@example.com",
          emailVerified: true,
          name: "Google to Suspended",
        });

        // Then
        await expect(
          loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken }),
        ).rejects.toThrow(DomainException);
      });
    });
  });

  describe("사용자 상태 검증", () => {
    it("잠긴 사용자의 로그인을 거부해야 한다", async () => {
      // Given
      const token = "locked-user-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "locked-user-id",
        email: "locked@example.com",
        emailVerified: true,
        name: "Locked User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      requireRecord(
        (
          await client
            .update(userTable)
            .set({ status: "LOCKED" })
            .where(eq(userTable.id, result.userId))
            .returning({ id: userTable.id })
        )[0],
      );

      // When
      const outcome = loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // Then
      await expect(outcome).rejects.toThrow(DomainException);
    });

    it("정지된 사용자의 로그인을 거부해야 한다", async () => {
      // Given
      const token = "suspended-user-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "suspended-user-id",
        email: "suspended@example.com",
        emailVerified: true,
        name: "Suspended User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      requireRecord(
        (
          await client
            .update(userTable)
            .set({ status: "SUSPENDED" })
            .where(eq(userTable.id, result.userId))
            .returning({ id: userTable.id })
        )[0],
      );

      // When
      const outcome = loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // Then
      await expect(outcome).rejects.toThrow(DomainException);
    });

    it("이메일 미인증 사용자도 소셜 로그인이 허용되어야 한다", async () => {
      // Given
      const token = "pending-user-token";
      fakeTokenVerifier.setCustomProfile("kakao", token, {
        id: "pending-user-id",
        email: "pending@example.com",
        emailVerified: false, // 미인증
        name: "Pending User",
      });

      // When
      const firstResult = await loginWithOAuthToken.execute({ provider: "KAKAO", token: token });
      expect(firstResult.userId).toBeDefined();

      const user = await client.query.user.findFirst({ where: { id: firstResult.userId } });
      expect(user?.status).toBe("ACTIVE");

      const secondResult = await loginWithOAuthToken.execute({ provider: "KAKAO", token: token });
      expect(secondResult.userId).toBe(firstResult.userId);
    });
  });

  describe("기본 카테고리 생성 (실제 DB)", () => {
    const categoryTestCases = [
      {
        provider: "APPLE",
        token: "apple-category-test-token",
        profile: {
          id: "apple-category-user",
          email: "apple-category@example.com",
          emailVerified: true,
        },
      },
      {
        provider: "GOOGLE",
        token: "google-category-test-token",
        profile: {
          id: "google-category-user",
          email: "google-category@example.com",
          emailVerified: true,
          name: "Google Category User",
        },
      },
      {
        provider: "KAKAO",
        token: "kakao-category-test-token",
        profile: {
          id: "kakao-category-user",
          email: "kakao-category@example.com",
          emailVerified: false,
          name: "Kakao Category User",
        },
      },
      {
        provider: "NAVER",
        token: "naver-category-test-token",
        profile: {
          id: "naver-category-user",
          email: "naver-category@example.com",
          emailVerified: false,
          name: "Naver Category User",
        },
      },
    ] satisfies Array<{
      provider: SocialProvider;
      token: string;
      profile: Parameters<FakeOAuthTokenVerifierService["setCustomProfile"]>[2];
    }>;

    it.each(categoryTestCases)(
      "$provider 로그인 시 기본 카테고리가 DB에 생성되어야 한다",
      async ({ provider, token, profile }) => {
        // Given
        fakeTokenVerifier.setCustomProfile(profileProviders[provider], token, profile);

        // When
        const result = await loginWithOAuthToken.execute({ provider, token });

        // Then
        const categories = await client.query.todoCategory.findMany({
          where: { userId: result.userId },
          orderBy: { sortOrder: "asc" },
        });

        expect(categories).toHaveLength(2);
        expect(categories[0]).toMatchObject({
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
        });
        expect(categories[1]).toMatchObject({
          name: "할 일",
          color: "#FF6B43",
          sortOrder: 1,
        });
      },
    );

    it("기존 사용자 재로그인 시 카테고리가 중복 생성되지 않아야 한다", async () => {
      // Given
      const token = "duplicate-category-test-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "duplicate-category-user",
        email: "duplicate-category@example.com",
        emailVerified: true,
        name: "Duplicate Test User",
      });

      const firstResult = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      const categoriesAfterFirst = await client.query.todoCategory.findMany({
        where: { userId: firstResult.userId },
      });
      expect(categoriesAfterFirst).toHaveLength(2);

      // When
      const secondResult = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // Then
      expect(secondResult.userId).toBe(firstResult.userId);

      const categoriesAfterSecond = await client.query.todoCategory.findMany({
        where: { userId: secondResult.userId },
      });
      expect(categoriesAfterSecond).toHaveLength(2);
    });
  });

  describe("자동 연동 트랜잭션 원자성 (실제 DB)", () => {
    const email = "auto-link-atomic@example.com";

    it("신뢰 Provider 자동 연동이 계정·세션·보안로그를 하나의 트랜잭션으로 함께 커밋한다", async () => {
      // Given
      const googleToken = "atomic-google-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "atomic-google-id",
        email,
        emailVerified: true,
        name: "Atomic User",
      });
      const first = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken });
      const userId = first.userId;

      // When
      const appleToken = "atomic-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", appleToken, {
        id: "atomic-apple-id",
        email,
        emailVerified: true,
      });
      const result = await loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken });

      // Then
      expect(result.userId).toBe(userId);
      expect(result.sessionId).toBeDefined();

      const accounts = await client.query.account.findMany({ where: { userId } });
      expect(accounts.map((a) => a.provider).sort()).toEqual(["APPLE", "GOOGLE"]);

      const sessions = await client.query.session.findMany({ where: { userId } });
      expect(sessions.length).toBeGreaterThanOrEqual(1);

      const autoLinkedLogs = await client.query.securityLog.findMany({
        where: { userId, event: "OAUTH_AUTO_LINKED" },
      });
      expect(autoLinkedLogs).toHaveLength(1);
      expect(autoLinkedLogs[0]?.metadata).toMatchObject({
        provider: "APPLE",
        autoLinked: true,
      });
    });

    it("자동 연동 단계가 실패하면 세션·계정이 부분 커밋되지 않는다", async () => {
      // Given
      const seedToken = "atomic-seed-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", seedToken, {
        id: "atomic-existing-apple-id",
        email,
        emailVerified: true,
      });
      const seeded = await loginWithOAuthToken.execute({ provider: "APPLE", token: seedToken });
      const userId = seeded.userId;

      const sessionsBefore = (
        await client
          .select({ total: count() })
          .from(sessionTable)
          .where(eq(sessionTable.userId, userId))
      )[0]?.total;

      // When
      const conflictToken = "atomic-conflict-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", conflictToken, {
        id: "atomic-conflict-apple-id",
        email,
        emailVerified: true,
      });

      // Then
      await expect(
        loginWithOAuthToken.execute({ provider: "APPLE", token: conflictToken }),
      ).rejects.toThrow();

      const conflictAccount = await client.query.account.findFirst({
        where: { userId, providerAccountId: "atomic-conflict-apple-id" },
      });
      expect(conflictAccount).toBeUndefined();

      const sessionsAfter = (
        await client
          .select({ total: count() })
          .from(sessionTable)
          .where(eq(sessionTable.userId, userId))
      )[0]?.total;
      expect(sessionsAfter).toBe(sessionsBefore);
    });
  });
});

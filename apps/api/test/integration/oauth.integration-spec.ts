import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";
import type { TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import type { OAuthIdentityProvider } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { ExchangeOAuthCode } from "#api/modules/identity/application/use-cases/auth/exchange-oauth-code.use-case";
import { GetOAuthRedirectUri } from "#api/modules/identity/application/use-cases/auth/get-oauth-redirect-uri.use-case";
import { LinkOAuthAccount } from "#api/modules/identity/application/use-cases/auth/link-oauth-account.use-case";
import { ListLinkedAccounts } from "#api/modules/identity/application/use-cases/auth/list-linked-accounts.use-case";
import { LoginWithOAuthToken } from "#api/modules/identity/application/use-cases/auth/login-with-oauth-token.use-case";
import { UnlinkOAuthAccount } from "#api/modules/identity/application/use-cases/auth/unlink-oauth-account.use-case";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import {
  AppleOAuthProvider,
  GoogleOAuthProvider,
  KakaoOAuthProvider,
  NaverOAuthProvider,
} from "#api/modules/identity/infrastructure/oauth/auth/adapters/index";
import { OAuthStateRepository } from "#api/modules/identity/infrastructure/persistence/auth/oauth-state.repository";
import { decodeRecord, encodePatch } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import type { DatabaseService } from "#api/platform/database/database.service";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "#test/mocks/fake-oauth-token-verifier.service";
import { createTestDatabaseService } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase } from "#test/setup/test-database";

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
  let loginWithOAuthToken: LoginWithOAuthToken;
  let linkOAuthAccount: LinkOAuthAccount;
  let unlinkOAuthAccount: UnlinkOAuthAccount;
  let listLinkedAccounts: ListLinkedAccounts;
  let getOAuthRedirectUri: GetOAuthRedirectUri;
  let exchangeOAuthCode: ExchangeOAuthCode;
  let fakeTokenVerifier: FakeOAuthTokenVerifierService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;
  let oauthStateRepository: OAuthStateRepository;

  beforeAll(async () => {
    testDb = new TestDatabase();
    databaseService = createTestDatabaseService(await testDb.start());
    fakeTokenVerifier = new FakeOAuthTokenVerifierService();
    const getConfig = () => ({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      callbackUrl: "http://localhost:3000/auth/callback",
      isConfigured: true,
    });
    const logger = new Logger("OAuthIdentityProvider");
    const http = new HttpClient({ retry: false, throwOnHttpError: false });
    const registry = new Map<AccountProvider, OAuthIdentityProvider>([
      ["APPLE", new AppleOAuthProvider(fakeTokenVerifier)],
      ["GOOGLE", new GoogleOAuthProvider(getConfig, fakeTokenVerifier, logger, http)],
      ["KAKAO", new KakaoOAuthProvider(getConfig, fakeTokenVerifier, logger, http)],
      ["NAVER", new NaverOAuthProvider(getConfig, fakeTokenVerifier, logger, http)],
    ]);
    module = await createAuthTestModule(databaseService, new FakeEmailService(), {
      oauthProviderRegistry: registry,
    });
    loginWithOAuthToken = module.get(LoginWithOAuthToken);
    linkOAuthAccount = module.get(LinkOAuthAccount);
    unlinkOAuthAccount = module.get(UnlinkOAuthAccount);
    listLinkedAccounts = module.get(ListLinkedAccounts);
    getOAuthRedirectUri = module.get(GetOAuthRedirectUri);
    exchangeOAuthCode = module.get(ExchangeOAuthCode);
    oauthStateRepository = module.get(OAuthStateRepository);
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
      // Given: Google 토큰에 대한 프로필 설정
      fakeTokenVerifier.setCustomProfile("google", testGoogleToken, {
        id: "google-user-123",
        email: "google-user@example.com",
        emailVerified: true,
        name: "Google User",
        picture: "https://example.com/avatar.jpg",
      });

      // When: Google 로그인 처리
      const result = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: testGoogleToken,
        metadata: {
          ip: "127.0.0.1",
          userAgent: "TestAgent",
        },
      });

      // Then: 로그인 결과 검증
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.name).toBe("Google User");
      expect(result.profileImage).toBe("https://example.com/avatar.jpg");

      // DB에 사용자가 생성되었는지 확인
      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId))
          .include("accounts")
          .include("profile")
          .first(),
      );
      expect(user).not.toBeNull();
      expect(user?.email).toBe("google-user@example.com");
      expect(user?.status).toBe("ACTIVE"); // emailVerified가 true이므로 ACTIVE
      expect(user?.accounts).toHaveLength(1);
      expect(user?.accounts[0]?.provider).toBe("GOOGLE");
      expect(user?.accounts[0]?.providerAccountId).toBe("google-user-123");
      expect(user?.profile?.name).toBe("Google User");
    });

    it("기존 사용자가 다시 Google 로그인하면 동일한 계정으로 로그인되어야 한다", async () => {
      // Given: 첫 번째 로그인으로 사용자 생성
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

      // When: 두 번째 로그인
      const secondLogin = await loginWithOAuthToken.execute({
        provider: "GOOGLE",
        token: testGoogleToken,
      });

      // Then: 같은 사용자로 로그인됨
      expect(secondLogin.userId).toBe(userId);
      expect(secondLogin.tokens.accessToken).toBeDefined();

      // 사용자가 중복 생성되지 않았는지 확인
      const users = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) =>
          row.email.eq(varchar("returning@example.com", 255)),
        ).all(),
      );
      expect(users).toHaveLength(1);
    });

    it("Google 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
      // Given: 토큰 검증 실패 설정
      fakeTokenVerifier.simulateFailure();

      // When & Then: 로그인 실패
      await expect(
        loginWithOAuthToken.execute({
          provider: "GOOGLE",
          token: "invalid-token",
          metadata: {
            ip: "192.168.1.1",
            userAgent: "FailTestAgent",
          },
        }),
      ).rejects.toThrow();

      // LoginAttempt 기록 확인
      const attempts = decodeRecord(
        "LoginAttempt",
        await databaseService.db.orm.public.LoginAttempt.where((row) =>
          row.email.eq(varchar("google_unknown@social.aido.kr", 255)),
        ).all(),
      );
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.success).toBe(false);
      expect(attempts[0]?.ipAddress).toBe("192.168.1.1");
      expect(attempts[0]?.failureReason).toBe("OAUTH_TOKEN_INVALID");
    });
  });

  describe("Naver OAuth 모바일 로그인", () => {
    const testNaverToken = "test-naver-access-token-12345";

    it("첫 Naver 로그인 시 새 사용자를 생성해야 한다", async () => {
      // Given: Naver 토큰에 대한 프로필 설정
      fakeTokenVerifier.setCustomProfile("naver", testNaverToken, {
        id: "naver-user-456",
        email: "naver-user@example.com",
        emailVerified: true,
        name: "Naver User",
        picture: "https://example.com/naver-avatar.jpg",
      });

      // When: Naver 로그인 처리
      const result = await loginWithOAuthToken.execute({
        provider: "NAVER",
        token: testNaverToken,
        metadata: {
          ip: "127.0.0.1",
          userAgent: "TestAgent",
        },
      });

      // Then: 로그인 결과 검증
      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.name).toBe("Naver User");

      // DB에 사용자가 생성되었는지 확인
      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId))
          .include("accounts")
          .first(),
      );
      expect(user).not.toBeNull();
      expect(user?.accounts[0]?.provider).toBe("NAVER");
      expect(user?.accounts[0]?.providerAccountId).toBe("naver-user-456");
    });

    it("기존 사용자가 다시 Naver 로그인하면 동일한 계정으로 로그인되어야 한다", async () => {
      // Given: 첫 번째 로그인
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

      // When: 두 번째 로그인
      const secondLogin = await loginWithOAuthToken.execute({
        provider: "NAVER",
        token: testNaverToken,
      });

      // Then: 같은 사용자
      expect(secondLogin.userId).toBe(firstLogin.userId);
    });

    it("Naver 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
      // Given: 토큰 검증 실패
      fakeTokenVerifier.simulateFailure();

      // When & Then
      await expect(
        loginWithOAuthToken.execute({
          provider: "NAVER",
          token: "invalid-naver-token",
          metadata: {
            ip: "10.0.0.1",
            userAgent: "NaverFailTest",
          },
        }),
      ).rejects.toThrow();

      // LoginAttempt 확인
      const attempts = decodeRecord(
        "LoginAttempt",
        await databaseService.db.orm.public.LoginAttempt.where((row) =>
          row.email.eq(varchar("naver_unknown@social.aido.kr", 255)),
        ).all(),
      );
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

      // 소셜 로그인 유저는 항상 ACTIVE로 생성됨
      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId)).first(),
      );
      expect(user?.status).toBe("ACTIVE");
    });

    it("Kakao 로그인 시 이메일이 없어도 처리할 수 있어야 한다", async () => {
      // Given: 이메일 없이 Kakao 로그인
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

      // Then: 플레이스홀더 이메일로 생성
      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId)).first(),
      );
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

      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId))
          .include("accounts")
          .include("profile")
          .first(),
      );
      expect(user?.accounts[0]?.provider).toBe("APPLE");
      expect(user?.profile?.name).toBe("Apple User");
    });
  });

  describe("계정 연결/해제", () => {
    let testUserId: string;

    beforeEach(async () => {
      // 테스트용 사용자 생성 (Google로 로그인)
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
      // When: Naver 계정 연결
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "naver-link-id"),
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");

      // DB 확인
      const accounts = decodeRecord(
        "Account",
        await databaseService.db.orm.public.Account.where((row) => row.userId.eq(testUserId)).all(),
      );
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.provider)).toContain("GOOGLE");
      expect(accounts.map((a) => a.provider)).toContain("NAVER");
    });

    it("이미 연결된 계정을 다시 연결하면 안내 메시지를 반환해야 한다", async () => {
      // Given: 이미 Naver 계정 연결
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "existing-naver-id"),
      });

      // When: 같은 계정 다시 연결 시도
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "existing-naver-id"),
      });

      // Then
      expect(result.message).toBe("이미 연결된 계정입니다.");
    });

    it("여러 계정이 연결된 상태에서 소셜 계정을 해제할 수 있어야 한다", async () => {
      // Given: 두 개의 계정이 연결된 상태
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "unlink-naver-id"),
      });

      // When: Naver 계정 해제
      const result = await unlinkOAuthAccount.execute({ userId: testUserId, provider: "NAVER" });

      // Then
      expect(result.message).toBe("계정 연결이 해제되었습니다.");

      const accounts = decodeRecord(
        "Account",
        await databaseService.db.orm.public.Account.where((row) => row.userId.eq(testUserId)).all(),
      );
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.provider).toBe("GOOGLE");
    });

    it("마지막 계정을 해제하려고 하면 에러를 발생시켜야 한다", async () => {
      // When & Then: 마지막 계정 해제 시도
      await expect(
        unlinkOAuthAccount.execute({ userId: testUserId, provider: "GOOGLE" }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.USER_0610,
        message: "마지막 로그인 수단은 해제할 수 없습니다.",
      });
    });

    it("연결된 계정 목록을 조회할 수 있어야 한다", async () => {
      // Given: 추가 계정 연결
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

      // Then: 항상 4개 항목 반환
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
      // 테스트용 사용자 생성 (Google로 로그인)
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
      // Given: Kakao 계정 연동
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-roundtrip-id"),
      });

      // 연결 확인
      let result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(true);

      // When: 해제
      await unlinkOAuthAccount.execute({ userId: testUserId, provider: "KAKAO" });

      // 해제 확인
      result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(false);

      // When: 재연동
      const linkResult = await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-roundtrip-id"),
      });

      // Then: 재연동 성공
      expect(linkResult.message).toBe("계정이 연결되었습니다.");
      result = await listLinkedAccounts.execute({ userId: testUserId });
      expect(result.accounts.find((a) => a.provider === "KAKAO")?.linked).toBe(true);
    });

    it("4개 provider 모두 같은 유저에 연동할 수 있어야 한다", async () => {
      // Given: 이미 Google 계정이 있음

      // When: 나머지 3개 provider 모두 연동
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

      // Then: 4개 모두 연동됨
      const { accounts } = await listLinkedAccounts.execute({ userId: testUserId });
      expect(accounts).toHaveLength(4);
      expect(accounts.every((a) => a.linked)).toBe(true);
    });

    it("linkAccount 시 SecurityLog(OAUTH_LINKED)가 기록되어야 한다", async () => {
      // When: 메타데이터와 함께 계정 연동
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "APPLE",
        accessToken: givenOAuthToken("APPLE", "apple-seclog-id"),
        metadata: {
          ip: "10.0.0.1",
          userAgent: "SecurityLogTest/1.0",
        },
      });

      // Then: SecurityLog 확인
      const logs = decodeRecord(
        "SecurityLog",
        await databaseService.db.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(testUserId), row.event.eq("OAUTH_LINKED")),
        ).all(),
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("10.0.0.1");
      expect(logs[0]?.userAgent).toBe("SecurityLogTest/1.0");
      expect(logs[0]?.metadata).toMatchObject({
        provider: "APPLE",
        providerAccountId: "apple-seclog-id",
      });
    });

    it("unlinkAccount 시 SecurityLog(OAUTH_UNLINKED)가 기록되어야 한다", async () => {
      // Given: KAKAO 계정 연동
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        accessToken: givenOAuthToken("KAKAO", "kakao-seclog-id"),
      });

      // When: 메타데이터와 함께 계정 해제
      await unlinkOAuthAccount.execute({
        userId: testUserId,
        provider: "KAKAO",
        metadata: {
          ip: "192.168.1.100",
          userAgent: "UnlinkTest/2.0",
        },
      });

      // Then: SecurityLog 확인
      const logs = decodeRecord(
        "SecurityLog",
        await databaseService.db.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(testUserId), row.event.eq("OAUTH_UNLINKED")),
        ).all(),
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("192.168.1.100");
      expect(logs[0]?.userAgent).toBe("UnlinkTest/2.0");
      expect(logs[0]?.metadata).toMatchObject({
        provider: "KAKAO",
      });
    });

    it("getLinkedAccounts가 providerAccountId를 반환해야 한다", async () => {
      // Given: NAVER 계정 연동
      await linkOAuthAccount.execute({
        userId: testUserId,
        provider: "NAVER",
        accessToken: givenOAuthToken("NAVER", "naver-pid-test"),
      });

      // When
      const { accounts } = await listLinkedAccounts.execute({ userId: testUserId });

      // Then: providerAccountId 포함 확인
      const naverAccount = accounts.find((a) => a.provider === "NAVER");
      expect(naverAccount).toBeDefined();
      expect(naverAccount?.linked).toBe(true);
      expect(naverAccount?.providerAccountId).toBe("naver-pid-test");
      expect(naverAccount?.linkedAt).toBeInstanceOf(Date);
    });

    it("다른 유저에 연결된 계정을 연동하면 409 에러가 발생해야 한다", async () => {
      // Given: 다른 유저가 APPLE 계정 보유
      const otherToken = "other-user-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", otherToken, {
        id: "conflict-apple-id",
        email: "other-apple@example.com",
        emailVerified: true,
        name: "Other Apple User",
      });

      await loginWithOAuthToken.execute({ provider: "APPLE", token: otherToken });

      // When & Then: 현재 유저가 같은 providerAccountId로 연동 시도
      await expect(
        linkOAuthAccount.execute({
          userId: testUserId,
          provider: "APPLE",
          accessToken: givenOAuthToken("APPLE", "conflict-apple-id"),
        }),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe("OAuth State 및 Exchange Code", () => {
    it("저장된 state로 redirectUri를 조회할 수 있어야 한다", async () => {
      // Given
      const state = "redirect-lookup-state";
      const redirectUri = "aido-dev://auth/naver";

      await oauthStateRepository.create(state, "NAVER", redirectUri);

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

      // When: OAuthState 생성
      const oauthState = await oauthStateRepository.create(state, "KAKAO", redirectUri);

      // Then
      expect(oauthState).toBeDefined();
      expect(oauthState.state).toBe(state);
      expect(oauthState.provider).toBe("KAKAO");
      expect(oauthState.redirectUri).toBe(redirectUri);

      // DB 확인
      const found = await oauthStateRepository.findByState(state);
      expect(found).not.toBeNull();
      expect(found?.state).toBe(state);
    });

    it("교환 코드로 토큰을 교환할 수 있어야 한다", async () => {
      // Given: 사용자 생성 후 OAuth State 및 Exchange Code 생성
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

      // OAuthState 생성
      const state = "exchange-state-456";
      const oauthState = await oauthStateRepository.create(state, "GOOGLE", "aido://auth/callback");

      // Exchange Code 생성
      const exchangeCode = oauthStateRepository.generateExchangeCode();
      await oauthStateRepository.saveExchangeData(oauthState.id, {
        exchangeCode,
        ...loginResult.tokens,
        userId: loginResult.userId,
        userName: loginResult.name ?? undefined,
      });

      expect(exchangeCode).toBeDefined();

      // When: 교환 코드로 토큰 교환
      const exchangeResult = await exchangeOAuthCode.execute({ code: exchangeCode });

      // Then
      expect(exchangeResult.accessToken).toBe(loginResult.tokens.accessToken);
      expect(exchangeResult.refreshToken).toBe(loginResult.tokens.refreshToken);
      expect(exchangeResult.userId).toBe(loginResult.userId);
    });

    it("유효하지 않은 교환 코드는 거부해야 한다", async () => {
      // When & Then
      await expect(exchangeOAuthCode.execute({ code: "invalid-exchange-code" })).rejects.toThrow(
        ApplicationException,
      );
    });

    it("이미 사용된 교환 코드는 거부해야 한다", async () => {
      // Given: Exchange Code 생성 및 사용
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

      const oauthState = await oauthStateRepository.create(
        "reuse-state",
        "GOOGLE",
        "aido://auth/callback",
      );

      const exchangeCode = oauthStateRepository.generateExchangeCode();
      await oauthStateRepository.saveExchangeData(oauthState.id, {
        exchangeCode,
        ...loginResult.tokens,
        userId: loginResult.userId,
      });

      // 첫 번째 교환 (성공)
      await exchangeOAuthCode.execute({ code: exchangeCode });

      // When & Then: 두 번째 교환 (실패)
      await expect(exchangeOAuthCode.execute({ code: exchangeCode })).rejects.toThrow(
        ApplicationException,
      );
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

      // Then: 보안 로그 확인
      const logs = decodeRecord(
        "SecurityLog",
        await databaseService.db.orm.public.SecurityLog.where((row) =>
          row.userId.eq(result.userId),
        ).all(),
      );

      // 회원가입 로그 + 로그인 성공 로그
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

      // Then: 세션 확인
      const session = decodeRecord(
        "Session",
        await databaseService.db.orm.public.Session.where((row) =>
          row.id.eq(result.sessionId),
        ).first(),
      );

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(result.userId);
      expect(session?.refreshTokenHash).toBeDefined();
    });
  });

  describe("토큰 검증과 소셜 계정 연결", () => {
    let testUserId: string;

    beforeEach(async () => {
      // 기존 사용자 생성 (Google)
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
      // Given: Kakao 토큰 설정
      const kakaoToken = "link-with-token-kakao";
      fakeTokenVerifier.setCustomProfile("kakao", kakaoToken, {
        id: "kakao-to-link",
        email: "kakao-link@example.com",
        emailVerified: false,
        name: "Kakao Link",
      });

      // When: 토큰 검증 후 계정 연동
      const result = await linkOAuthAccount.execute({
        userId: testUserId,
        ...{
          provider: "KAKAO",
          accessToken: kakaoToken,
        },
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");

      const accounts = decodeRecord(
        "Account",
        await databaseService.db.orm.public.Account.where((row) => row.userId.eq(testUserId)).all(),
      );
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.provider)).toContain("KAKAO");
    });

    it("Naver 계정을 토큰 검증을 통해 연결할 수 있어야 한다", async () => {
      // Given: Naver 토큰 설정
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
        ...{
          provider: "NAVER",
          accessToken: naverToken,
        },
      });

      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");
    });
  });

  describe("Provider별 자동/강제 연동", () => {
    describe("Google (신뢰된 Provider) 자동 연동", () => {
      it("기존 사용자의 이메일로 Google 로그인 시 자동 연동되어야 한다", async () => {
        // Given: 기존 Apple 사용자 생성
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

        // When: 같은 이메일로 Google 로그인
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

        // Then: 기존 사용자로 자동 연동됨
        expect(googleResult.userId).toBe(existingUserId);

        // 계정이 2개 연결되어 있어야 함
        const accounts = decodeRecord(
          "Account",
          await databaseService.db.orm.public.Account.where((row) =>
            row.userId.eq(existingUserId),
          ).all(),
        );
        expect(accounts).toHaveLength(2);
        expect(accounts.map((a) => a.provider).sort()).toEqual(["APPLE", "GOOGLE"]);

        // SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
        const logs = decodeRecord(
          "SecurityLog",
          await databaseService.db.orm.public.SecurityLog.where((row) =>
            and(row.userId.eq(existingUserId), row.event.eq("OAUTH_AUTO_LINKED")),
          ).all(),
        );
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "GOOGLE",
          autoLinked: true,
        });
      });

      it("자동 연동 후 정상적으로 토큰이 발급되어야 한다", async () => {
        // Given: 기존 Google 사용자
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

        // When: 다른 Google 계정으로 같은 이메일 로그인 시도 (실제로는 같은 사용자)
        // 실제 시나리오에서는 Apple로 연동 테스트
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

        // Then: 토큰이 정상 발급됨
        expect(appleResult.tokens.accessToken).toBeDefined();
        expect(appleResult.tokens.refreshToken).toBeDefined();
        expect(appleResult.sessionId).toBeDefined();

        // 세션도 정상 생성됨
        const session = decodeRecord(
          "Session",
          await databaseService.db.orm.public.Session.where((row) =>
            row.id.eq(appleResult.sessionId),
          ).first(),
        );
        expect(session).not.toBeNull();
        expect(session?.userId).toBe(firstResult.userId);
      });
    });

    describe("Apple (신뢰된 Provider) 자동 연동", () => {
      it("기존 사용자의 이메일로 Apple 로그인 시 자동 연동되어야 한다", async () => {
        // Given: 기존 Google 사용자 생성
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

        // When: 같은 이메일로 Apple 로그인
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

        // Then: 기존 사용자로 자동 연동됨
        expect(appleResult.userId).toBe(existingUserId);

        // SecurityLog 확인
        const logs = decodeRecord(
          "SecurityLog",
          await databaseService.db.orm.public.SecurityLog.where((row) =>
            and(row.userId.eq(existingUserId), row.event.eq("OAUTH_AUTO_LINKED")),
          ).all(),
        );
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "APPLE",
          autoLinked: true,
        });
      });
    });

    describe("Kakao (신뢰되지 않은 Provider) 강제 연동", () => {
      it("기존 사용자의 이메일로 Kakao 로그인 시 에러를 발생시켜야 한다", async () => {
        // Given: 기존 Google 사용자 생성
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

        // When: 같은 이메일로 Kakao 로그인 시도
        const kakaoToken = "conflicting-kakao-token";
        fakeTokenVerifier.setCustomProfile("kakao", kakaoToken, {
          id: "conflicting-kakao-id",
          email: "kakao-conflict@example.com",
          emailVerified: true,
          name: "Kakao User Same Email",
        });

        // Then: 에러 발생 (강제 연동 필요)
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

        // SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
        const logs = decodeRecord(
          "SecurityLog",
          await databaseService.db.orm.public.SecurityLog.where((row) =>
            and(row.userId.eq(existingUserId), row.event.eq("OAUTH_LINK_REQUIRED")),
          ).all(),
        );
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "KAKAO",
          reason: "untrusted_provider",
        });

        // 계정은 연결되지 않아야 함
        const accounts = decodeRecord(
          "Account",
          await databaseService.db.orm.public.Account.where((row) =>
            row.userId.eq(existingUserId),
          ).all(),
        );
        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.provider).toBe("GOOGLE");
      });
    });

    describe("Naver (신뢰되지 않은 Provider) 강제 연동", () => {
      it("기존 사용자의 이메일로 Naver 로그인 시 에러를 발생시켜야 한다", async () => {
        // Given: 기존 Apple 사용자 생성
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

        // When: 같은 이메일로 Naver 로그인 시도
        const naverToken = "conflicting-naver-token";
        fakeTokenVerifier.setCustomProfile("naver", naverToken, {
          id: "conflicting-naver-id",
          email: "naver-conflict@example.com",
          emailVerified: true,
          name: "Naver User Same Email",
        });

        // Then: 에러 발생 (강제 연동 필요)
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

        // SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
        const logs = decodeRecord(
          "SecurityLog",
          await databaseService.db.orm.public.SecurityLog.where((row) =>
            and(row.userId.eq(existingUserId), row.event.eq("OAUTH_LINK_REQUIRED")),
          ).all(),
        );
        expect(logs).toHaveLength(1);
        expect(logs[0]?.metadata).toMatchObject({
          provider: "NAVER",
          reason: "untrusted_provider",
        });
      });
    });

    describe("잠긴/정지된 사용자 자동 연동 불가", () => {
      it("잠긴 사용자에게 자동 연동을 시도하면 에러가 발생해야 한다", async () => {
        // Given: 잠긴 사용자 생성
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

        // 사용자 상태를 LOCKED로 변경
        decodeRecord(
          "User",
          requireRecord(
            await databaseService.db.orm.public.User.where((row) =>
              row.id.eq(result.userId),
            ).update(encodePatch("User", { status: "LOCKED" })),
          ),
        );

        // When: 같은 이메일로 Apple 로그인 시도
        const appleToken = "apple-to-locked-user-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "apple-to-locked-id",
          email: "locked-user@example.com",
          emailVerified: true,
          name: "Apple to Locked",
        });

        // Then: 에러 발생 (잠긴 사용자는 로그인 불가 — 도메인 상태 정책)
        await expect(
          loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken }),
        ).rejects.toThrow(DomainException);
      });

      it("정지된 사용자에게 자동 연동을 시도하면 에러가 발생해야 한다", async () => {
        // Given: 정지된 사용자 생성
        const appleToken = "suspended-auto-link-apple-token";
        fakeTokenVerifier.setCustomProfile("apple", appleToken, {
          id: "suspended-apple-id",
          email: "suspended-user@example.com",
          emailVerified: true,
          name: "Suspended User",
        });

        const result = await loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken });

        // 사용자 상태를 SUSPENDED로 변경
        decodeRecord(
          "User",
          requireRecord(
            await databaseService.db.orm.public.User.where((row) =>
              row.id.eq(result.userId),
            ).update(encodePatch("User", { status: "SUSPENDED" })),
          ),
        );

        // When: 같은 이메일로 Google 로그인 시도
        const googleToken = "google-to-suspended-user-token";
        fakeTokenVerifier.setCustomProfile("google", googleToken, {
          id: "google-to-suspended-id",
          email: "suspended-user@example.com",
          emailVerified: true,
          name: "Google to Suspended",
        });

        // Then: 에러 발생 (정지된 사용자는 로그인 불가 — 도메인 상태 정책)
        await expect(
          loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken }),
        ).rejects.toThrow(DomainException);
      });
    });
  });

  describe("사용자 상태 검증", () => {
    it("잠긴 사용자의 로그인을 거부해야 한다", async () => {
      // Given: 잠긴 사용자 생성
      const token = "locked-user-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "locked-user-id",
        email: "locked@example.com",
        emailVerified: true,
        name: "Locked User",
      });

      // 먼저 정상 로그인
      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // 사용자 상태를 LOCKED로 변경
      decodeRecord(
        "User",
        requireRecord(
          await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId)).update(
            encodePatch("User", { status: "LOCKED" }),
          ),
        ),
      );

      // When & Then: 다시 로그인 시도 시 실패 (도메인 상태 정책)
      await expect(
        loginWithOAuthToken.execute({ provider: "GOOGLE", token: token }),
      ).rejects.toThrow(DomainException);
    });

    it("정지된 사용자의 로그인을 거부해야 한다", async () => {
      // Given: 정지된 사용자 생성
      const token = "suspended-user-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "suspended-user-id",
        email: "suspended@example.com",
        emailVerified: true,
        name: "Suspended User",
      });

      const result = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // 사용자 상태를 SUSPENDED로 변경
      decodeRecord(
        "User",
        requireRecord(
          await databaseService.db.orm.public.User.where((row) => row.id.eq(result.userId)).update(
            encodePatch("User", { status: "SUSPENDED" }),
          ),
        ),
      );

      // When & Then (도메인 상태 정책)
      await expect(
        loginWithOAuthToken.execute({ provider: "GOOGLE", token: token }),
      ).rejects.toThrow(DomainException);
    });

    it("이메일 미인증 사용자도 소셜 로그인이 허용되어야 한다", async () => {
      // Given: 이메일 미인증 사용자 (Kakao로 생성)
      const token = "pending-user-token";
      fakeTokenVerifier.setCustomProfile("kakao", token, {
        id: "pending-user-id",
        email: "pending@example.com",
        emailVerified: false, // 미인증
        name: "Pending User",
      });

      // When: 첫 로그인
      const firstResult = await loginWithOAuthToken.execute({ provider: "KAKAO", token: token });
      expect(firstResult.userId).toBeDefined();

      // 상태 확인
      const user = decodeRecord(
        "User",
        await databaseService.db.orm.public.User.where((row) =>
          row.id.eq(firstResult.userId),
        ).first(),
      );
      expect(user?.status).toBe("ACTIVE");

      // 두 번째 로그인도 허용되어야 함
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
        // Given: 토큰 설정
        fakeTokenVerifier.setCustomProfile(profileProviders[provider], token, profile);

        // When: 로그인
        const result = await loginWithOAuthToken.execute({ provider, token });

        // Then: DB에서 카테고리 2개 확인
        const categories = decodeRecord(
          "TodoCategory",
          await databaseService.db.orm.public.TodoCategory.where((row) =>
            row.userId.eq(result.userId),
          )
            .orderBy((row) => row.sortOrder.asc())
            .all(),
        );

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
      // Given: 첫 번째 로그인으로 사용자 생성
      const token = "duplicate-category-test-token";
      fakeTokenVerifier.setCustomProfile("google", token, {
        id: "duplicate-category-user",
        email: "duplicate-category@example.com",
        emailVerified: true,
        name: "Duplicate Test User",
      });

      const firstResult = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // 첫 로그인 후 카테고리 개수 확인
      const categoriesAfterFirst = decodeRecord(
        "TodoCategory",
        await databaseService.db.orm.public.TodoCategory.where((row) =>
          row.userId.eq(firstResult.userId),
        ).all(),
      );
      expect(categoriesAfterFirst).toHaveLength(2);

      // When: 같은 사용자로 재로그인
      const secondResult = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: token });

      // Then: 같은 사용자이고 카테고리 개수가 여전히 2개
      expect(secondResult.userId).toBe(firstResult.userId);

      const categoriesAfterSecond = decodeRecord(
        "TodoCategory",
        await databaseService.db.orm.public.TodoCategory.where((row) =>
          row.userId.eq(secondResult.userId),
        ).all(),
      );
      expect(categoriesAfterSecond).toHaveLength(2);
    });
  });

  describe("자동 연동 트랜잭션 원자성 (실제 DB)", () => {
    const email = "auto-link-atomic@example.com";

    it("신뢰 Provider 자동 연동이 계정·세션·보안로그를 하나의 트랜잭션으로 함께 커밋한다", async () => {
      // Given: Google로 가입한 기존 사용자
      const googleToken = "atomic-google-token";
      fakeTokenVerifier.setCustomProfile("google", googleToken, {
        id: "atomic-google-id",
        email,
        emailVerified: true,
        name: "Atomic User",
      });
      const first = await loginWithOAuthToken.execute({ provider: "GOOGLE", token: googleToken });
      const userId = first.userId;

      // When: 같은 이메일의 검증된 Apple 계정으로 로그인 → 이메일 충돌 자동 연동
      const appleToken = "atomic-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", appleToken, {
        id: "atomic-apple-id",
        email,
        emailVerified: true,
      });
      const result = await loginWithOAuthToken.execute({ provider: "APPLE", token: appleToken });

      // Then: 동일 사용자에 연동 + 세션 발급 + OAUTH_AUTO_LINKED 보안로그가 함께 커밋됨
      expect(result.userId).toBe(userId);
      expect(result.sessionId).toBeDefined();

      const accounts = decodeRecord(
        "Account",
        await databaseService.db.orm.public.Account.where((row) => row.userId.eq(userId)).all(),
      );
      expect(accounts.map((a) => a.provider).sort()).toEqual(["APPLE", "GOOGLE"]);

      const sessions = decodeRecord(
        "Session",
        await databaseService.db.orm.public.Session.where((row) => row.userId.eq(userId)).all(),
      );
      expect(sessions.length).toBeGreaterThanOrEqual(1);

      const autoLinkedLogs = decodeRecord(
        "SecurityLog",
        await databaseService.db.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(userId), row.event.eq("OAUTH_AUTO_LINKED")),
        ).all(),
      );
      expect(autoLinkedLogs).toHaveLength(1);
      expect(autoLinkedLogs[0]?.metadata).toMatchObject({
        provider: "APPLE",
        autoLinked: true,
      });
    });

    it("자동 연동 단계가 실패하면 세션·계정이 부분 커밋되지 않는다", async () => {
      // Given: 이미 APPLE 계정이 연동된 기존 사용자
      const seedToken = "atomic-seed-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", seedToken, {
        id: "atomic-existing-apple-id",
        email,
        emailVerified: true,
      });
      const seeded = await loginWithOAuthToken.execute({ provider: "APPLE", token: seedToken });
      const userId = seeded.userId;

      const sessionsBefore = (
        await databaseService.db.orm.public.Session.where((row) => row.userId.eq(userId)).aggregate(
          (aggregate) => ({ count: aggregate.count() }),
        )
      ).count;

      // When: 같은 사용자에 "다른 providerAccountId"의 APPLE 로그인 시도.
      //  자동 연동에서 createOAuthAccount가 @@unique([userId, provider]) 위반으로 실패한다.
      const conflictToken = "atomic-conflict-apple-token";
      fakeTokenVerifier.setCustomProfile("apple", conflictToken, {
        id: "atomic-conflict-apple-id",
        email,
        emailVerified: true,
      });

      // Then: 에러가 발생하고 부분 커밋이 남지 않는다
      await expect(
        loginWithOAuthToken.execute({ provider: "APPLE", token: conflictToken }),
      ).rejects.toThrow();

      const conflictAccount = decodeRecord(
        "Account",
        await databaseService.db.orm.public.Account.where((row) =>
          and(
            row.userId.eq(userId),
            row.providerAccountId.eq(varchar("atomic-conflict-apple-id", 255)),
          ),
        ).first(),
      );
      expect(conflictAccount).toBeNull();

      const sessionsAfter = (
        await databaseService.db.orm.public.Session.where((row) => row.userId.eq(userId)).aggregate(
          (aggregate) => ({ count: aggregate.count() }),
        )
      ).count;
      expect(sessionsAfter).toBe(sessionsBefore);
    });
  });
});

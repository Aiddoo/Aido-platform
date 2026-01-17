/**
 * OAuth 통합 테스트 (Testcontainers)
 *
 * @description
 * OAuthService와 관련 Repository들이 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 컨테이너에서 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - OAuthService → Repository → Prisma → PostgreSQL 전체 스택 검증
 * - 소셜 로그인 플로우의 데이터베이스 연동 검증
 * - 계정 연결/해제 기능 검증
 * - 토큰 교환 플로우 검증
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test oauth.integration-spec
 * ```
 */

import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception";
import { DatabaseService } from "@/database/database.service";
import { AccountRepository } from "@/modules/auth/repositories/account.repository";
import { LoginAttemptRepository } from "@/modules/auth/repositories/login-attempt.repository";
import { OAuthStateRepository } from "@/modules/auth/repositories/oauth-state.repository";
import { SecurityLogRepository } from "@/modules/auth/repositories/security-log.repository";
import { SessionRepository } from "@/modules/auth/repositories/session.repository";
import { UserRepository } from "@/modules/auth/repositories/user.repository";
import { OAuthService } from "@/modules/auth/services/oauth.service";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { TokenService } from "@/modules/auth/services/token.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("OAuth 통합 테스트 (실제 DB)", () => {
	let module: TestingModule;
	let oauthService: OAuthService;
	let fakeTokenVerifier: FakeOAuthTokenVerifierService;
	let testDb: TestDatabase;
	let databaseService: DatabaseService;
	let accountRepository: AccountRepository;
	let userRepository: UserRepository;
	let oauthStateRepository: OAuthStateRepository;

	// 테스트 스위트 시작 시 한 번만 실행
	beforeAll(async () => {
		// TestContainer 시작 및 Database 연결
		testDb = new TestDatabase();
		databaseService = (await testDb.start()) as DatabaseService;

		// Fake OAuth Token Verifier 생성
		fakeTokenVerifier = new FakeOAuthTokenVerifierService();

		// NestJS 테스트 모듈 생성
		module = await Test.createTestingModule({
			imports: [
				JwtModule.register({
					secret: "test-jwt-secret-key-for-integration-tests",
					signOptions: { expiresIn: "15m" },
				}),
			],
			providers: [
				OAuthService,
				TokenService,
				AccountRepository,
				UserRepository,
				SessionRepository,
				SecurityLogRepository,
				LoginAttemptRepository,
				OAuthStateRepository,
				{
					provide: DatabaseService,
					useValue: databaseService,
				},
				{
					provide: OAuthTokenVerifierService,
					useValue: fakeTokenVerifier,
				},
				{
					provide: TypedConfigService,
					useValue: {
						get: (key: string) => {
							const config: Record<string, string> = {
								JWT_SECRET: "test-jwt-secret-key-for-integration-tests",
								JWT_EXPIRES_IN: "15m",
								JWT_REFRESH_SECRET:
									"test-jwt-refresh-secret-key-for-integration-tests",
								JWT_REFRESH_EXPIRES_IN: "7d",
							};
							return config[key];
						},
						// TokenService가 사용하는 getter들
						jwtSecret: "test-jwt-secret-key-for-integration-tests",
						jwtExpiresIn: "15m",
						jwtRefreshSecret:
							"test-jwt-refresh-secret-key-for-integration-tests",
						jwtRefreshExpiresIn: "7d",
						// 레거시 jwtConfig 객체
						jwtConfig: {
							secret: "test-jwt-secret-key-for-integration-tests",
							expiresIn: "15m",
							refreshSecret:
								"test-jwt-refresh-secret-key-for-integration-tests",
							refreshExpiresIn: "7d",
						},
						kakaoOAuth: {
							clientId: "test-kakao-client-id",
							clientSecret: "test-kakao-client-secret",
							callbackUrl: "http://localhost:3000/auth/kakao/callback",
							isConfigured: true,
						},
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: (key: string) => {
							const config: Record<string, string> = {
								JWT_SECRET: "test-jwt-secret-key-for-integration-tests",
								JWT_EXPIRES_IN: "15m",
								JWT_REFRESH_SECRET:
									"test-jwt-refresh-secret-key-for-integration-tests",
								JWT_REFRESH_EXPIRES_IN: "7d",
							};
							return config[key];
						},
					},
				},
			],
		}).compile();

		oauthService = module.get<OAuthService>(OAuthService);
		accountRepository = module.get<AccountRepository>(AccountRepository);
		userRepository = module.get<UserRepository>(UserRepository);
		oauthStateRepository =
			module.get<OAuthStateRepository>(OAuthStateRepository);
	}, 60000); // 컨테이너 시작에 시간이 걸릴 수 있음

	// 각 테스트 전 데이터 초기화
	beforeEach(async () => {
		await testDb.cleanup();
		fakeTokenVerifier.clear();
	});

	// 테스트 스위트 종료 시 정리
	afterAll(async () => {
		if (testDb) {
			await testDb.stop();
		}
		if (module) {
			await module.close();
		}
	});

	// ===========================================================================
	// Service 연결 테스트
	// ===========================================================================

	describe("서비스-레포지토리 연결", () => {
		it("oauthService가 정의되어 있어야 한다", () => {
			expect(oauthService).toBeDefined();
		});

		it("레포지토리들이 연결되어 있어야 한다", () => {
			expect(accountRepository).toBeDefined();
			expect(userRepository).toBeDefined();
			expect(oauthStateRepository).toBeDefined();
		});
	});

	// ===========================================================================
	// Google OAuth 로그인 테스트
	// ===========================================================================

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
			const result = await oauthService.handleGoogleMobileLogin(
				testGoogleToken,
				undefined,
				{ ip: "127.0.0.1", userAgent: "TestAgent" },
			);

			// Then: 로그인 결과 검증
			expect(result).toBeDefined();
			expect(result.userId).toBeDefined();
			expect(result.tokens.accessToken).toBeDefined();
			expect(result.tokens.refreshToken).toBeDefined();
			expect(result.sessionId).toBeDefined();
			expect(result.name).toBe("Google User");
			expect(result.profileImage).toBe("https://example.com/avatar.jpg");

			// DB에 사용자가 생성되었는지 확인
			const user = await databaseService.user.findUnique({
				where: { id: result.userId },
				include: { accounts: true, profile: true },
			});
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

			const firstLogin =
				await oauthService.handleGoogleMobileLogin(testGoogleToken);
			const userId = firstLogin.userId;

			// When: 두 번째 로그인
			const secondLogin =
				await oauthService.handleGoogleMobileLogin(testGoogleToken);

			// Then: 같은 사용자로 로그인됨
			expect(secondLogin.userId).toBe(userId);
			expect(secondLogin.tokens.accessToken).toBeDefined();

			// 사용자가 중복 생성되지 않았는지 확인
			const users = await databaseService.user.findMany({
				where: { email: "returning@example.com" },
			});
			expect(users).toHaveLength(1);
		});

		it("Google 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
			// Given: 토큰 검증 실패 설정
			fakeTokenVerifier.simulateFailure();

			// When & Then: 로그인 실패
			await expect(
				oauthService.handleGoogleMobileLogin("invalid-token", undefined, {
					ip: "192.168.1.1",
					userAgent: "FailTestAgent",
				}),
			).rejects.toThrow();

			// LoginAttempt 기록 확인
			const attempts = await databaseService.loginAttempt.findMany({
				where: { email: "google_unknown@social.aido.app" },
			});
			expect(attempts).toHaveLength(1);
			expect(attempts[0]?.success).toBe(false);
			expect(attempts[0]?.ipAddress).toBe("192.168.1.1");
			expect(attempts[0]?.failureReason).toBe("OAUTH_TOKEN_INVALID");
		});
	});

	// ===========================================================================
	// Naver OAuth 로그인 테스트
	// ===========================================================================

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
			const result = await oauthService.handleNaverMobileLogin(
				testNaverToken,
				undefined,
				{ ip: "127.0.0.1", userAgent: "TestAgent" },
			);

			// Then: 로그인 결과 검증
			expect(result).toBeDefined();
			expect(result.userId).toBeDefined();
			expect(result.tokens.accessToken).toBeDefined();
			expect(result.tokens.refreshToken).toBeDefined();
			expect(result.name).toBe("Naver User");

			// DB에 사용자가 생성되었는지 확인
			const user = await databaseService.user.findUnique({
				where: { id: result.userId },
				include: { accounts: true },
			});
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

			const firstLogin =
				await oauthService.handleNaverMobileLogin(testNaverToken);

			// When: 두 번째 로그인
			const secondLogin =
				await oauthService.handleNaverMobileLogin(testNaverToken);

			// Then: 같은 사용자
			expect(secondLogin.userId).toBe(firstLogin.userId);
		});

		it("Naver 토큰 검증 실패 시 LoginAttempt를 기록해야 한다", async () => {
			// Given: 토큰 검증 실패
			fakeTokenVerifier.simulateFailure();

			// When & Then
			await expect(
				oauthService.handleNaverMobileLogin("invalid-naver-token", undefined, {
					ip: "10.0.0.1",
					userAgent: "NaverFailTest",
				}),
			).rejects.toThrow();

			// LoginAttempt 확인
			const attempts = await databaseService.loginAttempt.findMany({
				where: { email: "naver_unknown@social.aido.app" },
			});
			expect(attempts).toHaveLength(1);
			expect(attempts[0]?.success).toBe(false);
		});
	});

	// ===========================================================================
	// Kakao OAuth 로그인 테스트
	// ===========================================================================

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
			const result = await oauthService.handleKakaoMobileLogin(testKakaoToken);

			// Then
			expect(result).toBeDefined();
			expect(result.userId).toBeDefined();
			expect(result.name).toBe("Kakao User");

			// Kakao는 이메일 미인증 상태로 생성될 수 있음
			const user = await databaseService.user.findUnique({
				where: { id: result.userId },
			});
			expect(user?.status).toBe("PENDING_VERIFY"); // emailVerified가 false
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
			const result = await oauthService.handleKakaoMobileLogin(testKakaoToken);

			// Then: 플레이스홀더 이메일로 생성
			const user = await databaseService.user.findUnique({
				where: { id: result.userId },
			});
			expect(user?.email).toMatch(/^kakao_kakao-no-email@social\.aido\.app$/);
		});
	});

	// ===========================================================================
	// Apple OAuth 로그인 테스트
	// ===========================================================================

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
			const result = await oauthService.handleAppleMobileLogin(
				testAppleToken,
				"Apple User", // userName 직접 제공
			);

			// Then
			expect(result).toBeDefined();
			expect(result.userId).toBeDefined();

			const user = await databaseService.user.findUnique({
				where: { id: result.userId },
				include: { accounts: true, profile: true },
			});
			expect(user?.accounts[0]?.provider).toBe("APPLE");
			expect(user?.profile?.name).toBe("Apple User");
		});
	});

	// ===========================================================================
	// 계정 연결/해제 테스트
	// ===========================================================================

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

			const result = await oauthService.handleGoogleMobileLogin(googleToken);
			testUserId = result.userId;
		});

		it("기존 사용자에게 추가 소셜 계정을 연결할 수 있어야 한다", async () => {
			// When: Naver 계정 연결
			const result = await oauthService.linkAccount(
				testUserId,
				"NAVER",
				"naver-link-id",
			);

			// Then
			expect(result.message).toBe("계정이 연결되었습니다.");

			// DB 확인
			const accounts = await databaseService.account.findMany({
				where: { userId: testUserId },
			});
			expect(accounts).toHaveLength(2);
			expect(accounts.map((a) => a.provider)).toContain("GOOGLE");
			expect(accounts.map((a) => a.provider)).toContain("NAVER");
		});

		it("이미 연결된 계정을 다시 연결하면 안내 메시지를 반환해야 한다", async () => {
			// Given: 이미 Naver 계정 연결
			await oauthService.linkAccount(testUserId, "NAVER", "existing-naver-id");

			// When: 같은 계정 다시 연결 시도
			const result = await oauthService.linkAccount(
				testUserId,
				"NAVER",
				"existing-naver-id",
			);

			// Then
			expect(result.message).toBe("이미 연결된 계정입니다.");
		});

		it("여러 계정이 연결된 상태에서 소셜 계정을 해제할 수 있어야 한다", async () => {
			// Given: 두 개의 계정이 연결된 상태
			await oauthService.linkAccount(testUserId, "NAVER", "unlink-naver-id");

			// When: Naver 계정 해제
			const result = await oauthService.unlinkAccount(testUserId, "NAVER");

			// Then
			expect(result.message).toBe("계정 연결이 해제되었습니다.");

			const accounts = await databaseService.account.findMany({
				where: { userId: testUserId },
			});
			expect(accounts).toHaveLength(1);
			expect(accounts[0]?.provider).toBe("GOOGLE");
		});

		it("마지막 계정을 해제하려고 하면 에러를 발생시켜야 한다", async () => {
			// When & Then: 마지막 계정 해제 시도
			await expect(
				oauthService.unlinkAccount(testUserId, "GOOGLE"),
			).rejects.toThrow(BusinessException);
		});

		it("연결된 계정 목록을 조회할 수 있어야 한다", async () => {
			// Given: 추가 계정 연결
			await oauthService.linkAccount(testUserId, "KAKAO", "kakao-link-id");
			await oauthService.linkAccount(testUserId, "APPLE", "apple-link-id");

			// When
			const linkedAccounts = await oauthService.getLinkedAccounts(testUserId);

			// Then
			expect(linkedAccounts).toHaveLength(3);
			const providers = linkedAccounts.map((a) => a.provider);
			expect(providers).toContain("GOOGLE");
			expect(providers).toContain("KAKAO");
			expect(providers).toContain("APPLE");
		});
	});

	// ===========================================================================
	// OAuth State 및 Exchange Code 테스트
	// ===========================================================================

	describe("OAuth State 및 Exchange Code", () => {
		it("리다이렉트 URI와 함께 OAuth State를 생성할 수 있어야 한다", async () => {
			// Given
			const state = "test-csrf-state-123";
			const redirectUri = "aido://auth/callback";

			// When: OAuthState 생성
			const oauthState = await oauthStateRepository.create(
				state,
				"KAKAO",
				redirectUri,
			);

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

			const loginResult =
				await oauthService.handleGoogleMobileLogin(googleToken);

			// OAuthState 생성
			const state = "exchange-state-456";
			const oauthState = await oauthStateRepository.create(
				state,
				"GOOGLE",
				"aido://auth/callback",
			);

			// Exchange Code 생성
			const exchangeCode = await oauthService.createExchangeCode(
				oauthState.id,
				loginResult.tokens,
				{
					userId: loginResult.userId,
					userName: loginResult.name ?? undefined,
				},
			);

			expect(exchangeCode).toBeDefined();

			// When: 교환 코드로 토큰 교환
			const exchangeResult =
				await oauthService.exchangeCodeForTokens(exchangeCode);

			// Then
			expect(exchangeResult.accessToken).toBe(loginResult.tokens.accessToken);
			expect(exchangeResult.refreshToken).toBe(loginResult.tokens.refreshToken);
			expect(exchangeResult.userId).toBe(loginResult.userId);
		});

		it("유효하지 않은 교환 코드는 거부해야 한다", async () => {
			// When & Then
			await expect(
				oauthService.exchangeCodeForTokens("invalid-exchange-code"),
			).rejects.toThrow(BusinessException);
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

			const loginResult =
				await oauthService.handleGoogleMobileLogin(googleToken);

			const oauthState = await oauthStateRepository.create(
				"reuse-state",
				"GOOGLE",
				"aido://auth/callback",
			);

			const exchangeCode = await oauthService.createExchangeCode(
				oauthState.id,
				loginResult.tokens,
				{ userId: loginResult.userId },
			);

			// 첫 번째 교환 (성공)
			await oauthService.exchangeCodeForTokens(exchangeCode);

			// When & Then: 두 번째 교환 (실패)
			await expect(
				oauthService.exchangeCodeForTokens(exchangeCode),
			).rejects.toThrow(BusinessException);
		});
	});

	// ===========================================================================
	// 보안 로그 및 세션 테스트
	// ===========================================================================

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
			const result = await oauthService.handleGoogleMobileLogin(
				token,
				undefined,
				{
					ip: "203.0.113.1",
					userAgent: "SecurityTestAgent/1.0",
				},
			);

			// Then: 보안 로그 확인
			const logs = await databaseService.securityLog.findMany({
				where: { userId: result.userId },
			});

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
			const result = await oauthService.handleGoogleMobileLogin(token);

			// Then: 세션 확인
			const session = await databaseService.session.findUnique({
				where: { id: result.sessionId },
			});

			expect(session).not.toBeNull();
			expect(session?.userId).toBe(result.userId);
			expect(session?.refreshTokenHash).toBeDefined();
		});
	});

	// ===========================================================================
	// 토큰 검증 연동 테스트
	// ===========================================================================

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

			const result = await oauthService.handleGoogleMobileLogin(googleToken);
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
			const result = await oauthService.linkSocialAccountWithToken(testUserId, {
				provider: "KAKAO",
				accessToken: kakaoToken,
			});

			// Then
			expect(result.message).toBe("계정이 연결되었습니다.");

			const accounts = await databaseService.account.findMany({
				where: { userId: testUserId },
			});
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
			const result = await oauthService.linkSocialAccountWithToken(testUserId, {
				provider: "NAVER",
				accessToken: naverToken,
			});

			// Then
			expect(result.message).toBe("계정이 연결되었습니다.");
		});
	});

	// ===========================================================================
	// Provider별 자동/강제 연동 통합 테스트
	// ===========================================================================

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

				const appleResult =
					await oauthService.handleAppleMobileLogin(appleToken);
				const existingUserId = appleResult.userId;

				// When: 같은 이메일로 Google 로그인
				const googleToken = "new-google-login-token";
				fakeTokenVerifier.setCustomProfile("google", googleToken, {
					id: "new-google-id",
					email: "shared-email@example.com",
					emailVerified: true,
					name: "Google User Same Email",
				});

				const googleResult = await oauthService.handleGoogleMobileLogin(
					googleToken,
					undefined,
					{ ip: "127.0.0.1", userAgent: "TestAgent" },
				);

				// Then: 기존 사용자로 자동 연동됨
				expect(googleResult.userId).toBe(existingUserId);

				// 계정이 2개 연결되어 있어야 함
				const accounts = await databaseService.account.findMany({
					where: { userId: existingUserId },
				});
				expect(accounts).toHaveLength(2);
				expect(accounts.map((a) => a.provider).sort()).toEqual([
					"APPLE",
					"GOOGLE",
				]);

				// SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
				const logs = await databaseService.securityLog.findMany({
					where: {
						userId: existingUserId,
						event: "OAUTH_AUTO_LINKED",
					},
				});
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

				const firstResult =
					await oauthService.handleGoogleMobileLogin(firstGoogleToken);

				// When: 다른 Google 계정으로 같은 이메일 로그인 시도 (실제로는 같은 사용자)
				// 실제 시나리오에서는 Apple로 연동 테스트
				const appleToken = "link-apple-token";
				fakeTokenVerifier.setCustomProfile("apple", appleToken, {
					id: "link-apple-id",
					email: "token-test@example.com",
					emailVerified: true,
					name: "Apple Same Email",
				});

				const appleResult = await oauthService.handleAppleMobileLogin(
					appleToken,
					undefined,
					{ ip: "10.0.0.1", userAgent: "AppleTest" },
				);

				// Then: 토큰이 정상 발급됨
				expect(appleResult.tokens.accessToken).toBeDefined();
				expect(appleResult.tokens.refreshToken).toBeDefined();
				expect(appleResult.sessionId).toBeDefined();

				// 세션도 정상 생성됨
				const session = await databaseService.session.findUnique({
					where: { id: appleResult.sessionId },
				});
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

				const googleResult =
					await oauthService.handleGoogleMobileLogin(googleToken);
				const existingUserId = googleResult.userId;

				// When: 같은 이메일로 Apple 로그인
				const appleToken = "new-apple-login-token";
				fakeTokenVerifier.setCustomProfile("apple", appleToken, {
					id: "new-apple-id",
					email: "apple-test@example.com",
					emailVerified: true,
					name: "Apple User Same Email",
				});

				const appleResult = await oauthService.handleAppleMobileLogin(
					appleToken,
					"Apple User",
					{ ip: "192.168.1.1", userAgent: "AppleTestAgent" },
				);

				// Then: 기존 사용자로 자동 연동됨
				expect(appleResult.userId).toBe(existingUserId);

				// SecurityLog 확인
				const logs = await databaseService.securityLog.findMany({
					where: {
						userId: existingUserId,
						event: "OAUTH_AUTO_LINKED",
					},
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
				// Given: 기존 Google 사용자 생성
				const googleToken = "kakao-conflict-google-token";
				fakeTokenVerifier.setCustomProfile("google", googleToken, {
					id: "kakao-conflict-google-id",
					email: "kakao-conflict@example.com",
					emailVerified: true,
					name: "Google User",
				});

				const googleResult =
					await oauthService.handleGoogleMobileLogin(googleToken);
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
					oauthService.handleKakaoMobileLogin(kakaoToken, undefined, {
						ip: "172.16.0.1",
						userAgent: "KakaoTestAgent",
					}),
				).rejects.toThrow(BusinessException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				const logs = await databaseService.securityLog.findMany({
					where: {
						userId: existingUserId,
						event: "OAUTH_LINK_REQUIRED",
					},
				});
				expect(logs).toHaveLength(1);
				expect(logs[0]?.metadata).toMatchObject({
					provider: "KAKAO",
					reason: "untrusted_provider",
				});

				// 계정은 연결되지 않아야 함
				const accounts = await databaseService.account.findMany({
					where: { userId: existingUserId },
				});
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

				const appleResult =
					await oauthService.handleAppleMobileLogin(appleToken);
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
					oauthService.handleNaverMobileLogin(naverToken, undefined, {
						ip: "172.16.0.2",
						userAgent: "NaverTestAgent",
					}),
				).rejects.toThrow(BusinessException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				const logs = await databaseService.securityLog.findMany({
					where: {
						userId: existingUserId,
						event: "OAUTH_LINK_REQUIRED",
					},
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
				// Given: 잠긴 사용자 생성
				const googleToken = "locked-auto-link-google-token";
				fakeTokenVerifier.setCustomProfile("google", googleToken, {
					id: "locked-google-id",
					email: "locked-user@example.com",
					emailVerified: true,
					name: "Locked User",
				});

				const result = await oauthService.handleGoogleMobileLogin(googleToken);

				// 사용자 상태를 LOCKED로 변경
				await databaseService.user.update({
					where: { id: result.userId },
					data: { status: "LOCKED" },
				});

				// When: 같은 이메일로 Apple 로그인 시도
				const appleToken = "apple-to-locked-user-token";
				fakeTokenVerifier.setCustomProfile("apple", appleToken, {
					id: "apple-to-locked-id",
					email: "locked-user@example.com",
					emailVerified: true,
					name: "Apple to Locked",
				});

				// Then: 에러 발생 (잠긴 사용자는 로그인 불가)
				await expect(
					oauthService.handleAppleMobileLogin(appleToken),
				).rejects.toThrow(BusinessException);
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

				const result = await oauthService.handleAppleMobileLogin(appleToken);

				// 사용자 상태를 SUSPENDED로 변경
				await databaseService.user.update({
					where: { id: result.userId },
					data: { status: "SUSPENDED" },
				});

				// When: 같은 이메일로 Google 로그인 시도
				const googleToken = "google-to-suspended-user-token";
				fakeTokenVerifier.setCustomProfile("google", googleToken, {
					id: "google-to-suspended-id",
					email: "suspended-user@example.com",
					emailVerified: true,
					name: "Google to Suspended",
				});

				// Then: 에러 발생 (정지된 사용자는 로그인 불가)
				await expect(
					oauthService.handleGoogleMobileLogin(googleToken),
				).rejects.toThrow(BusinessException);
			});
		});
	});

	// ===========================================================================
	// 사용자 상태 검증 테스트
	// ===========================================================================

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
			const result = await oauthService.handleGoogleMobileLogin(token);

			// 사용자 상태를 LOCKED로 변경
			await databaseService.user.update({
				where: { id: result.userId },
				data: { status: "LOCKED" },
			});

			// When & Then: 다시 로그인 시도 시 실패
			await expect(oauthService.handleGoogleMobileLogin(token)).rejects.toThrow(
				BusinessException,
			);
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

			const result = await oauthService.handleGoogleMobileLogin(token);

			// 사용자 상태를 SUSPENDED로 변경
			await databaseService.user.update({
				where: { id: result.userId },
				data: { status: "SUSPENDED" },
			});

			// When & Then
			await expect(oauthService.handleGoogleMobileLogin(token)).rejects.toThrow(
				BusinessException,
			);
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
			const firstResult = await oauthService.handleKakaoMobileLogin(token);
			expect(firstResult.userId).toBeDefined();

			// 상태 확인
			const user = await databaseService.user.findUnique({
				where: { id: firstResult.userId },
			});
			expect(user?.status).toBe("PENDING_VERIFY");

			// 두 번째 로그인도 허용되어야 함
			const secondResult = await oauthService.handleKakaoMobileLogin(token);
			expect(secondResult.userId).toBe(firstResult.userId);
		});
	});
});

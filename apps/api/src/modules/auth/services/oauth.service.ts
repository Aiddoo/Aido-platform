import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import {
	now,
	subtractDays,
	toISOString,
	toISOStringOrNull,
} from "@/common/date";
import { EncryptionService } from "@/common/encryption";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import {
	type AccountProvider,
	type OAuthState,
	Prisma,
} from "@/generated/prisma/client";
import {
	AdminNotificationEvents,
	type UserRegisteredEventPayload,
} from "../../admin-notification/events/admin-notification.events";
import {
	ACCOUNT_DELETION,
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
	TRUSTED_EMAIL_PROVIDERS,
} from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import {
	type OAuthMode,
	OAuthStateRepository,
} from "../repositories/oauth-state.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";
import type { LoginResult, RequestMetadata } from "../types";
import {
	AppleOAuthProvider,
	GoogleOAuthProvider,
	type IOAuthProviderStrategy,
	KakaoOAuthProvider,
	NaverOAuthProvider,
} from "./oauth-providers";
import { OAuthTokenVerifierService } from "./oauth-token-verifier.service";
import { SessionService } from "./session.service";

/**
 * AccountProvider → 이벤트 페이로드 provider 매핑
 */
const ACCOUNT_PROVIDER_TO_EVENT: Record<
	AccountProvider,
	UserRegisteredEventPayload["provider"]
> = {
	CREDENTIAL: "credential",
	APPLE: "apple",
	GOOGLE: "google",
	KAKAO: "kakao",
	NAVER: "naver",
};

// Apple, Google, Kakao, Naver OAuth 소셜 로그인 처리
@Injectable()
export class OAuthService {
	readonly #logger = new Logger(OAuthService.name);
	readonly #providers: Map<AccountProvider, IOAuthProviderStrategy>;

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly loginAttemptRepository: LoginAttemptRepository,
		private readonly oauthStateRepository: OAuthStateRepository,
		private readonly sessionService: SessionService,
		private readonly tokenVerifier: OAuthTokenVerifierService,
		private readonly configService: TypedConfigService,
		private readonly encryptionService: EncryptionService,
		private readonly eventEmitter: EventEmitter2,
		private readonly cacheService: CacheService,
	) {
		this.#providers = new Map<AccountProvider, IOAuthProviderStrategy>([
			["APPLE", new AppleOAuthProvider(this.tokenVerifier)],
			[
				"GOOGLE",
				new GoogleOAuthProvider(
					() => this.configService.googleOAuth,
					this.tokenVerifier,
					this.#logger,
				),
			],
			[
				"KAKAO",
				new KakaoOAuthProvider(
					() => this.configService.kakaoOAuth,
					this.tokenVerifier,
					this.#logger,
				),
			],
			[
				"NAVER",
				new NaverOAuthProvider(
					() => this.configService.naverOAuth,
					this.tokenVerifier,
					this.#logger,
				),
			],
		]);
	}

	#getStrategy(provider: AccountProvider): IOAuthProviderStrategy {
		const strategy = this.#providers.get(provider);
		if (!strategy) {
			throw BusinessExceptions.socialProviderError(provider, {
				reason: `Unsupported provider: ${provider}`,
			});
		}
		return strategy;
	}

	// 보안을 위한 화이트리스트 방식 검증 (환경별 분기)
	get #allowedRedirectPatterns(): RegExp[] {
		const patterns: RegExp[] = [
			// 모바일 앱 딥링크 (프로덕션)
			/^aido:\/\/auth(\/.*)?$/,
			// 모바일 앱 딥링크 (프로덕션, triple slash)
			/^aido:\/\/\/auth(\/.*)?$/,
			// aido.kr 도메인 (프로덕션)
			/^https:\/\/aido\.kr(\/.*)?$/,
			// aido.kr 서브도메인 (명시적 허용만)
			/^https:\/\/(api|www|app)\.aido\.kr(\/.*)?$/,
		];

		if (this.configService.isDevelopment) {
			patterns.push(
				// 모바일 앱 딥링크 (개발)
				/^aido-dev:\/\/auth(\/.*)?$/,
				// 모바일 앱 딥링크 (개발, triple slash)
				/^aido-dev:\/\/\/auth(\/.*)?$/,
				// 로컬 개발 환경
				/^http:\/\/localhost(:\d+)?(\/.*)?$/,
				// Expo Go 개발 환경 (exp:// scheme)
				/^exp:\/\/[\d.:]+(\/.*)?$/,
			);
		}

		return patterns;
	}

	readonly #DEFAULT_REDIRECT_URI = "aido://auth/callback";

	#validateRedirectUri(redirectUri?: string): string {
		if (!redirectUri) {
			return this.#DEFAULT_REDIRECT_URI;
		}

		const isValid = this.#allowedRedirectPatterns.some((pattern) =>
			pattern.test(redirectUri),
		);

		if (!isValid) {
			this.#logger.warn(
				`Invalid redirect_uri rejected: ${redirectUri}. Using default.`,
			);
			return this.#DEFAULT_REDIRECT_URI;
		}

		return redirectUri;
	}

	async #validateAndGetOAuthState(state: string): Promise<OAuthState> {
		const existingState = await this.oauthStateRepository.findByState(state);
		if (!existingState) {
			this.#logger.warn(`Invalid OAuth state: ${state}`);
			throw BusinessExceptions.invalidCredentials();
		}
		return existingState;
	}

	async getRedirectUriByState(state: string): Promise<string | null> {
		const existingState = await this.oauthStateRepository.findByState(state);
		return existingState?.redirectUri ?? null;
	}

	// ============================================
	// Strategy 기반 통합 메서드
	// ============================================

	/**
	 * 모바일 로그인 통합 처리
	 *
	 * Provider 전략 클래스에 토큰 검증과 옵션 빌드를 위임하고,
	 * 공통 흐름(#handleSocialLogin, 실패 기록)을 관리합니다.
	 */
	async #handleMobileLogin(
		provider: AccountProvider,
		token: string,
		userName?: string,
		metadata?: RequestMetadata,
		nonce?: string,
	): Promise<LoginResult> {
		const strategy = this.#getStrategy(provider);
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
			const verifiedProfile = await strategy.verifyToken(token, nonce);
			const opts = strategy.buildLoginOptions(verifiedProfile, userName);

			return this.#handleSocialLogin(
				provider,
				verifiedProfile.id,
				verifiedProfile.email ?? undefined,
				{ ...opts, metadata },
			);
		} catch (error) {
			await this.loginAttemptRepository.create({
				email: strategy.failureEmail,
				provider,
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
			});
			throw error;
		}
	}

	/**
	 * Auth URL 생성 통합 처리
	 */
	async #generateAuthUrlWithState(
		provider: AccountProvider,
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		const strategy = this.#getStrategy(provider);
		const validatedRedirectUri = this.#validateRedirectUri(clientRedirectUri);

		const persistState = (
			p: AccountProvider,
			redirectUri: string,
			opts: { mode?: OAuthMode; initiatingUserId?: string },
		) => this.oauthStateRepository.create(state, p, redirectUri, opts);

		const url = await strategy.generateAuthUrl({
			state,
			validatedRedirectUri,
			mode,
			initiatingUserId,
			persistState,
		});

		if (!url) {
			throw BusinessExceptions.invalidCredentials();
		}
		return url;
	}

	/**
	 * Web Callback + ExchangeCode 통합 처리
	 */
	async #handleWebCallbackWithExchangeCode(
		provider: AccountProvider,
		code: string,
		state: string,
		metadata?: RequestMetadata,
	): Promise<{
		exchangeCode: string;
		redirectUri: string;
		userId: string;
		name?: string;
		profileImage?: string;
	}> {
		const strategy = this.#getStrategy(provider);
		const oauthState = await this.#validateAndGetOAuthState(state);
		const redirectUri = oauthState.redirectUri || this.#DEFAULT_REDIRECT_URI;

		const exchanged = await strategy.exchangeCode(code, state);
		if (!exchanged) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Linking 모드: 로그인 대신 providerAccountId만 추출하여 저장
		if (oauthState.mode === "link") {
			const verifiedProfile = await strategy.verifyToken(exchanged.token);
			const exchangeCode = await this.#saveLinkingExchangeCode(
				oauthState.id,
				oauthState.provider,
				verifiedProfile.id,
			);

			return {
				exchangeCode,
				redirectUri,
				userId: verifiedProfile.id,
			};
		}

		// 기존 로그인 모드
		const loginResult = await this.#handleMobileLogin(
			provider,
			exchanged.token,
			undefined,
			metadata,
		);

		const exchangeCode = await this.createExchangeCode(
			oauthState.id,
			loginResult.tokens,
			{
				userId: loginResult.userId,
				userName: loginResult.name ?? undefined,
				profileImage: loginResult.profileImage ?? undefined,
				accountRestored: loginResult.accountRestored,
			},
		);

		return {
			exchangeCode,
			redirectUri,
			userId: loginResult.userId,
			name: loginResult.name ?? undefined,
			profileImage: loginResult.profileImage ?? undefined,
		};
	}

	// ============================================
	// Public delegates — 컨트롤러 인터페이스 유지
	// ============================================

	async generateKakaoAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		return this.#generateAuthUrlWithState(
			"KAKAO",
			state,
			clientRedirectUri,
			mode,
			initiatingUserId,
		);
	}

	async generateGoogleAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		return this.#generateAuthUrlWithState(
			"GOOGLE",
			state,
			clientRedirectUri,
			mode,
			initiatingUserId,
		);
	}

	async generateNaverAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		return this.#generateAuthUrlWithState(
			"NAVER",
			state,
			clientRedirectUri,
			mode,
			initiatingUserId,
		);
	}

	async handleKakaoWebCallbackWithExchangeCode(
		code: string,
		state: string,
		metadata?: RequestMetadata,
	) {
		return this.#handleWebCallbackWithExchangeCode(
			"KAKAO",
			code,
			state,
			metadata,
		);
	}

	async handleGoogleWebCallbackWithExchangeCode(
		code: string,
		state: string,
		metadata?: RequestMetadata,
	) {
		return this.#handleWebCallbackWithExchangeCode(
			"GOOGLE",
			code,
			state,
			metadata,
		);
	}

	async handleNaverWebCallbackWithExchangeCode(
		code: string,
		state: string,
		metadata?: RequestMetadata,
	) {
		return this.#handleWebCallbackWithExchangeCode(
			"NAVER",
			code,
			state,
			metadata,
		);
	}

	async handleAppleMobileLogin(
		idToken: string,
		userName?: string,
		metadata?: RequestMetadata,
		nonce?: string,
	): Promise<LoginResult> {
		return this.#handleMobileLogin("APPLE", idToken, userName, metadata, nonce);
	}

	async handleGoogleMobileLogin(
		idToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this.#handleMobileLogin("GOOGLE", idToken, userName, metadata);
	}

	async handleKakaoMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this.#handleMobileLogin("KAKAO", accessToken, userName, metadata);
	}

	async handleNaverMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this.#handleMobileLogin("NAVER", accessToken, userName, metadata);
	}

	async linkAccount(
		userId: string,
		provider: AccountProvider,
		providerAccountId: string,
		refreshToken?: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		// 이미 다른 사용자에 연결되었는지 확인
		const existingAccount =
			await this.accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		if (existingAccount && existingAccount.userId !== userId) {
			throw this.#getAlreadyLinkedExceptionForProvider(
				provider,
				providerAccountId,
			);
		}

		// 이미 연결된 경우
		if (existingAccount) {
			return { message: "이미 연결된 계정입니다." };
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 계정 연결 + 보안 로그 (트랜잭션)
		try {
			await this.database.$transaction(async (tx) => {
				await this.accountRepository.createOAuthAccount(
					{
						userId,
						provider,
						providerAccountId,
						refreshToken,
					},
					tx,
				);

				await this.securityLogRepository.create(
					{
						userId,
						event: SECURITY_EVENT.OAUTH_LINKED,
						ipAddress: ip,
						userAgent,
						metadata: { provider, providerAccountId },
					},
					tx,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw this.#getAlreadyLinkedExceptionForProvider(
					provider,
					providerAccountId,
				);
			}
			throw error;
		}

		this.#logger.log(`Account linked: ${provider} for user ${userId}`);

		await this.cacheService.invalidateUserProfile(userId);

		return { message: "계정이 연결되었습니다." };
	}

	async linkSocialAccountWithToken(
		userId: string,
		dto: {
			provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER";
			idToken?: string;
			accessToken?: string;
			nonce?: string;
		},
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const { provider, idToken, accessToken, nonce } = dto;
		const strategy = this.#providers.get(provider);

		if (!strategy) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Apple/Google은 idToken, Kakao/Naver는 accessToken 사용
		const token = idToken ?? accessToken;
		if (!token) {
			throw BusinessExceptions.invalidCredentials();
		}

		const profile = await strategy.verifyToken(token, nonce);

		return this.linkAccount(userId, provider, profile.id, undefined, metadata);
	}

	async unlinkAccount(
		userId: string,
		provider: AccountProvider,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		// 연결된 계정 조회
		const account = await this.accountRepository.findByUserIdAndProvider(
			userId,
			provider,
		);

		if (!account) {
			throw BusinessExceptions.accountNotFound();
		}

		// 마지막 로그인 수단인지 확인
		const allAccounts = await this.accountRepository.findAllByUserId(userId);
		if (allAccounts.length <= 1) {
			throw BusinessExceptions.cannotUnlinkLastAccount();
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 계정 삭제 + 보안 로그 (트랜잭션)
		await this.database.$transaction(async (tx) => {
			await this.accountRepository.deleteAccount(userId, provider, tx);

			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.OAUTH_UNLINKED,
					ipAddress: ip,
					userAgent,
					metadata: { provider },
				},
				tx,
			);
		});

		this.#logger.log(`Account unlinked: ${provider} for user ${userId}`);

		await this.cacheService.invalidateUserProfile(userId);

		return { message: "계정 연결이 해제되었습니다." };
	}

	async getLinkedAccounts(userId: string): Promise<
		{
			provider: (typeof OAUTH_PROVIDERS)[number];
			linked: boolean;
			providerAccountId: string | null;
			linkedAt: Date | null;
		}[]
	> {
		const accounts = await this.accountRepository.findAllByUserId(userId);

		const linkedMap = new Map(
			accounts
				.filter((account) => account.provider !== "CREDENTIAL")
				.map((account) => [
					account.provider,
					{
						providerAccountId: account.providerAccountId,
						linkedAt: account.createdAt,
					},
				]),
		);

		return OAUTH_PROVIDERS.map((provider) => {
			const linked = linkedMap.get(provider);
			return {
				provider,
				linked: !!linked,
				providerAccountId: linked?.providerAccountId ?? null,
				linkedAt: linked?.linkedAt ?? null,
			};
		});
	}

	async #handleSocialLogin(
		provider: AccountProvider,
		providerAccountId: string,
		email: string | undefined,
		options: {
			userName?: string;
			emailVerified?: boolean;
			appleRefreshToken?: string;
			profileImage?: string;
			metadata?: RequestMetadata;
		},
	): Promise<LoginResult> {
		const ip = options.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent =
			options.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 기존 OAuth 계정 조회
		const existingAccount =
			await this.accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		let userId: string;
		let userEmail: string;

		if (existingAccount) {
			// 기존 사용자 로그인
			userId = existingAccount.userId;
			const user = await this.userRepository.findById(userId);

			if (!user) {
				throw BusinessExceptions.userNotFound(userId);
			}

			// 탈퇴 사용자: 유예 기간 내 복구 또는 차단
			if (user.deletedAt) {
				const gracePeriodCutoff = subtractDays(
					ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
				);
				if (user.deletedAt > gracePeriodCutoff) {
					// 30일 이내 — 복구 + 세션 생성을 원자적으로 처리
					const loginResult = await this.#restoreAndCreateSession(user, {
						ip,
						userAgent,
						provider,
					});
					return { ...loginResult, accountRestored: true };
				}
				// 30일 초과 — 차단
				throw BusinessExceptions.accountDeleted(userId);
			}

			this.#validateUserStatus(user.status);
			userEmail = user.email;

			this.#logger.debug(`Existing ${provider} user login: ${userId}`);
		} else {
			// 신규 사용자
			// 이메일이 없는 경우 (카카오 등) 플레이스홀더 이메일 생성
			const effectiveEmail =
				email ??
				`${provider.toLowerCase()}_${providerAccountId}@social.aido.kr`;

			// 이메일로 기존 사용자 확인 (실제 이메일인 경우에만)
			if (email) {
				const existingUser = await this.userRepository.findByEmail(email);
				if (existingUser) {
					// 이메일은 있지만 해당 소셜 계정이 연결되지 않은 경우
					// Provider별 자동 연동 또는 강제 연동 처리
					return this.#handleEmailConflict(
						existingUser,
						provider,
						providerAccountId,
						{
							emailVerified: options.emailVerified,
							appleRefreshToken: options.appleRefreshToken,
							ip,
							userAgent,
						},
					);
				}
			}

			// 신규 회원가입
			const newUser = await this.#createSocialUser({
				email: effectiveEmail,
				provider,
				providerAccountId,
				userName: options.userName,
				emailVerified: options.emailVerified ?? false,
				refreshToken: options.appleRefreshToken,
				profileImage: options.profileImage,
			});

			userId = newUser.id;
			userEmail = effectiveEmail;

			this.#logger.log(`New ${provider} user registered: ${userId}`);

			this.eventEmitter.emit(AdminNotificationEvents.USER_REGISTERED, {
				userId,
				email: effectiveEmail,
				provider: ACCOUNT_PROVIDER_TO_EVENT[provider],
				registeredAt: toISOString(now()),
			} satisfies UserRegisteredEventPayload);
		}

		// 세션 생성 및 토큰 발급
		return this.#createSessionAndTokens(userId, userEmail, {
			ip,
			userAgent,
			provider,
		});
	}

	// emailVerified=true → ACTIVE, emailVerified=false → PENDING_VERIFY (로그인은 허용)
	async #createSocialUser(data: {
		email: string;
		provider: AccountProvider;
		providerAccountId: string;
		userName?: string;
		emailVerified: boolean;
		refreshToken?: string;
		profileImage?: string;
	}) {
		return this.database.$transaction(async (tx) => {
			// User 생성 (소셜 로그인은 이메일 인증 상태에 따라 상태 결정)
			// - Apple/Google: emailVerified=true → ACTIVE
			// - Kakao/Naver: emailVerified 불확실 → PENDING_VERIFY 가능
			const user = await this.userRepository.create(
				{
					email: data.email,
					status: data.emailVerified ? "ACTIVE" : "PENDING_VERIFY",
					emailVerifiedAt: data.emailVerified ? now() : null,
				},
				tx,
			);

			// OAuth Account 연결
			await this.accountRepository.createOAuthAccount(
				{
					userId: user.id,
					provider: data.provider,
					providerAccountId: data.providerAccountId,
					refreshToken: data.refreshToken,
				},
				tx,
			);

			// 프로필 생성
			await this.userRepository.createProfile(
				user.id,
				{ name: data.userName, profileImage: data.profileImage },
				tx,
			);

			// 기본 약관 동의 (소셜 로그인 시 기본 동의로 처리)
			const currentTime = now();
			await tx.userConsent.create({
				data: {
					userId: user.id,
					termsAgreedAt: currentTime,
					privacyAgreedAt: currentTime,
					marketingAgreedAt: currentTime,
				},
			});

			// 푸시 알림 설정 초기화 (기본값: 모두 ON)
			await tx.userPreference.create({
				data: {
					userId: user.id,
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});

			// 기본 카테고리는 user.registered 이벤트를 통해 TodoCategoryModule에서 생성

			// 보안 로그
			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.REGISTRATION,
					ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
					userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
					metadata: { provider: data.provider },
				},
				tx,
			);

			return user;
		});
	}

	/**
	 * 탈퇴 계정 복구 + 세션 생성을 원자적 트랜잭션으로 수행
	 *
	 * 복구와 세션 생성이 하나의 트랜잭션으로 묶여,
	 * 세션 생성 실패 시 복구도 롤백됩니다.
	 */
	async #restoreAndCreateSession(
		user: { id: string; email: string; deletedAt: Date | null },
		options: { ip: string; userAgent: string; provider: AccountProvider },
	): Promise<LoginResult> {
		// 사용자 role 조회 (트랜잭션 밖)
		const userRecord = await this.database.user.findUnique({
			where: { id: user.id },
			select: { role: true },
		});

		if (!userRecord) {
			throw BusinessExceptions.userNotFound(user.id);
		}

		const result = await this.database.$transaction(async (tx) => {
			// 1. 계정 복구
			await this.#restoreDeletedAccount(
				user,
				{ ip: options.ip, userAgent: options.userAgent },
				tx,
			);

			// 2. 세션 생성 + 보안 로그 + 로그인 시도 기록
			const { sessionId, tokens } =
				await this.sessionService.createSessionWithTokens(
					{
						userId: user.id,
						email: user.email,
						role: userRecord.role,
						deviceFingerprint: options.userAgent,
						userAgent: options.userAgent,
						ipAddress: options.ip,
					},
					tx,
				);

			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.LOGIN_SUCCESS,
					ipAddress: options.ip,
					userAgent: options.userAgent,
					metadata: { provider: options.provider },
				},
				tx,
			);

			await this.loginAttemptRepository.create(
				{
					email: user.email,
					provider: options.provider,
					ipAddress: options.ip,
					userAgent: options.userAgent,
					success: true,
				},
				tx,
			);

			const userWithProfile = await this.userRepository.findByIdWithProfile(
				user.id,
				tx,
			);

			return {
				userId: user.id,
				userTag: userWithProfile?.userTag ?? "",
				tokens,
				sessionId,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});

		// 트랜잭션 커밋 후 캐시 무효화
		await this.cacheService.invalidateUserProfile(user.id);
		this.#logger.log(`Deleted account restored on social login: ${user.id}`);

		return result;
	}

	async #createSessionAndTokens(
		userId: string,
		email: string,
		options: {
			ip: string;
			userAgent: string;
			provider: AccountProvider;
		},
	): Promise<LoginResult> {
		// 사용자 role 조회
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		return this.database.$transaction(async (tx) => {
			const { sessionId, tokens } =
				await this.sessionService.createSessionWithTokens(
					{
						userId,
						email,
						role: user.role,
						deviceFingerprint: options.userAgent,
						userAgent: options.userAgent,
						ipAddress: options.ip,
					},
					tx,
				);

			// 보안 로그
			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.LOGIN_SUCCESS,
					ipAddress: options.ip,
					userAgent: options.userAgent,
					metadata: { provider: options.provider },
				},
				tx,
			);

			// 로그인 시도 기록 (성공)
			await this.loginAttemptRepository.create(
				{
					email,
					provider: options.provider,
					ipAddress: options.ip,
					userAgent: options.userAgent,
					success: true,
				},
				tx,
			);

			// 프로필 조회
			const userWithProfile = await this.userRepository.findByIdWithProfile(
				userId,
				tx,
			);

			return {
				userId,
				userTag: userWithProfile?.userTag ?? "",
				tokens,
				sessionId,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});
	}

	/**
	 * 탈퇴 계정 복구 처리 (트랜잭션 내부에서 호출)
	 *
	 * - 사용자 상태를 ACTIVE로 복원
	 * - 보안 로그에 ACCOUNT_RESTORED 이벤트 기록
	 * - 캐시 무효화는 트랜잭션 커밋 후 호출측에서 수행
	 */
	async #restoreDeletedAccount(
		user: { id: string; deletedAt: Date | null },
		metadata: { ip: string; userAgent: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await this.userRepository.restore(user.id, tx);

		await this.securityLogRepository.create(
			{
				userId: user.id,
				event: SECURITY_EVENT.ACCOUNT_RESTORED,
				ipAddress: metadata.ip,
				userAgent: metadata.userAgent,
				metadata: {
					deletedAt: toISOStringOrNull(user.deletedAt ?? null),
					restoredAt: toISOString(now()),
				},
			},
			tx,
		);
	}

	// PENDING_VERIFY 허용: 소셜 로그인은 OAuth Provider가 신원을 이미 검증함
	#validateUserStatus(status: string): void {
		switch (status) {
			case "LOCKED":
				throw BusinessExceptions.accountLocked("Social login user");
			case "SUSPENDED":
				throw BusinessExceptions.accountSuspended("Social login user");
			case "PENDING_VERIFY":
				// 의도된 동작: 소셜 로그인은 이메일 미인증 상태도 허용
				// Apple/Google은 emailVerified=true로 ACTIVE 상태로 생성됨
				// Kakao/Naver는 이메일 미인증 시 PENDING_VERIFY이지만 로그인 허용
				break;
			default:
				break;
		}
	}

	#getAlreadyLinkedExceptionForProvider(
		provider: AccountProvider,
		providerAccountId: string,
	): BusinessException {
		const exceptionMap: Partial<
			Record<AccountProvider, (id: string) => BusinessException>
		> = {
			KAKAO: BusinessExceptions.kakaoAccountAlreadyLinked,
			APPLE: BusinessExceptions.appleAccountAlreadyLinked,
			GOOGLE: BusinessExceptions.googleAccountAlreadyLinked,
			NAVER: BusinessExceptions.naverAccountAlreadyLinked,
		};
		const factory = exceptionMap[provider];
		return factory
			? factory(providerAccountId)
			: BusinessExceptions.accountAlreadyExists({
					provider,
					providerAccountId,
				});
	}

	// Google, Apple은 이메일 검증 보장. Kakao, Naver는 선택적.
	#isTrustedProvider(provider: AccountProvider): boolean {
		return TRUSTED_EMAIL_PROVIDERS.includes(provider);
	}

	// Google/Apple: 자동 연동, Kakao/Naver: 강제 연동 필요 (에러 반환)
	async #handleEmailConflict(
		existingUser: {
			id: string;
			email: string;
			status: string;
			deletedAt: Date | null;
		},
		provider: AccountProvider,
		providerAccountId: string,
		options: {
			emailVerified?: boolean;
			appleRefreshToken?: string;
			ip: string;
			userAgent: string;
		},
	): Promise<LoginResult> {
		// 탈퇴 사용자: 유예 기간 내 복구 또는 차단
		const needsRestore = !!existingUser.deletedAt;
		if (existingUser.deletedAt) {
			const gracePeriodCutoff = subtractDays(
				ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
			);
			if (existingUser.deletedAt <= gracePeriodCutoff) {
				// 30일 초과 — 차단
				throw BusinessExceptions.accountDeleted(existingUser.id);
			}
			// 30일 이내 — 아래에서 트랜잭션 내 복구 처리
		}

		const isTrusted = this.#isTrustedProvider(provider);
		const isEmailVerified = options.emailVerified === true;

		if (isTrusted && isEmailVerified) {
			// 자동 연동: 신뢰된 Provider + 이메일 검증됨
			this.#logger.log(
				`Auto-linking ${provider} account to existing user: ${existingUser.id}`,
			);

			// 사용자 상태 검증 (복구 대상은 skip — 트랜잭션 내에서 ACTIVE로 변경됨)
			if (!needsRestore) {
				this.#validateUserStatus(existingUser.status);
			}

			if (needsRestore) {
				// 복구 + 연동 + 세션 생성을 원자적 트랜잭션으로 수행
				const loginResult = await this.#restoreAndCreateSession(existingUser, {
					ip: options.ip,
					userAgent: options.userAgent,
					provider,
				});

				// 트랜잭션 커밋 후 OAuth Account 연결 (별도 트랜잭션)
				await this.database.$transaction(async (tx) => {
					await this.accountRepository.createOAuthAccount(
						{
							userId: existingUser.id,
							provider,
							providerAccountId,
							refreshToken: options.appleRefreshToken,
						},
						tx,
					);

					await this.securityLogRepository.create(
						{
							userId: existingUser.id,
							event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
							ipAddress: options.ip,
							userAgent: options.userAgent,
							metadata: {
								provider,
								autoLinked: true,
								reason: "trusted_provider_verified_email",
							},
						},
						tx,
					);
				});

				return { ...loginResult, accountRestored: true };
			}

			// 기존 유저: 연동만 수행
			await this.database.$transaction(async (tx) => {
				await this.accountRepository.createOAuthAccount(
					{
						userId: existingUser.id,
						provider,
						providerAccountId,
						refreshToken: options.appleRefreshToken,
					},
					tx,
				);

				await this.securityLogRepository.create(
					{
						userId: existingUser.id,
						event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
						ipAddress: options.ip,
						userAgent: options.userAgent,
						metadata: {
							provider,
							autoLinked: true,
							reason: "trusted_provider_verified_email",
						},
					},
					tx,
				);
			});

			return this.#createSessionAndTokens(existingUser.id, existingUser.email, {
				ip: options.ip,
				userAgent: options.userAgent,
				provider,
			});
		}

		// 강제 연동 필요: 신뢰되지 않은 Provider 또는 이메일 미검증
		this.#logger.warn(
			`Manual linking required for ${provider} account to user: ${existingUser.id}`,
		);

		// 보안 로그: 연동 필요 알림
		await this.securityLogRepository.create({
			userId: existingUser.id,
			event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
			ipAddress: options.ip,
			userAgent: options.userAgent,
			metadata: {
				provider,
				reason: isTrusted ? "email_not_verified" : "untrusted_provider",
			},
		});

		throw BusinessExceptions.socialAccountNotLinked(
			provider,
			providerAccountId,
			existingUser.email,
		);
	}

	/**
	 * Linking 모드 교환 코드 생성 및 저장
	 *
	 * login 모드와 달리 accessToken/refreshToken 대신
	 * providerAccountId를 저장합니다.
	 */
	async #saveLinkingExchangeCode(
		oauthStateId: number,
		provider: AccountProvider,
		providerAccountId: string,
	): Promise<string> {
		const exchangeCode = this.oauthStateRepository.generateExchangeCode();

		await this.oauthStateRepository.saveLinkingData(oauthStateId, {
			exchangeCode,
			provider,
			providerAccountId,
		});

		this.#logger.debug(
			`Linking exchange code created for provider ${provider}, OAuthState ID: ${oauthStateId}`,
		);

		return exchangeCode;
	}

	/**
	 * 일회용 교환 코드로 계정 연결 수행
	 *
	 * 웹 OAuth 콜백에서 linking 모드로 저장된 교환 코드를 사용하여
	 * 사용자 계정에 소셜 계정을 연결합니다.
	 */
	async linkAccountWithExchangeCode(
		userId: string,
		code: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const oauthState = await this.oauthStateRepository.findByExchangeCode(code);

		if (!oauthState || oauthState.mode !== "link") {
			this.#logger.warn(
				`Invalid or non-linking exchange code attempted: ${code.substring(0, 8)}...`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// initiatingUserId 검증: link 시작한 사용자만 교환 가능
		if (oauthState.initiatingUserId && oauthState.initiatingUserId !== userId) {
			this.#logger.warn(
				`Linking user mismatch: expected ${oauthState.initiatingUserId}, got ${userId}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// providerAccountId는 saveLinkingData에서 userId 필드에 저장됨
		const provider = oauthState.provider;
		const providerAccountId = oauthState.userId;

		if (!providerAccountId) {
			this.#logger.error(
				`Linking exchange code found but providerAccountId missing: OAuthState ID ${oauthState.id}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// 교환 완료 처리
		await this.oauthStateRepository.markAsExchanged(oauthState.id);

		this.#logger.debug(
			`Linking exchange code redeemed for user ${userId}, provider ${provider}, OAuthState ID: ${oauthState.id}`,
		);

		// 기존 linkAccount 메서드를 활용하여 계정 연결
		return this.linkAccount(
			userId,
			provider,
			providerAccountId,
			undefined,
			metadata,
		);
	}

	// 딥링크 URL에는 교환 코드만 전달하여 토큰 노출 방지
	async createExchangeCode(
		oauthStateId: number,
		tokens: { accessToken: string; refreshToken: string },
		userInfo: {
			userId: string;
			userName?: string;
			profileImage?: string;
			accountRestored?: boolean;
		},
	): Promise<string> {
		const exchangeCode = this.oauthStateRepository.generateExchangeCode();

		await this.oauthStateRepository.saveExchangeData(oauthStateId, {
			exchangeCode,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			userId: userInfo.userId,
			userName: userInfo.userName,
			profileImage: userInfo.profileImage,
			accountRestored: userInfo.accountRestored,
		});

		this.#logger.debug(
			`Exchange code created for user ${userInfo.userId}, OAuthState ID: ${oauthStateId}`,
		);

		return exchangeCode;
	}

	// 일회용 교환 코드 검증 후 토큰 반환, 교환 완료 후 DB에서 삭제
	async exchangeCodeForTokens(code: string): Promise<{
		accessToken: string;
		refreshToken: string;
		userId: string;
		userName?: string;
		profileImage?: string;
		accountRestored?: boolean;
	}> {
		// 교환 코드로 OAuthState 조회 (미교환 + 미만료만)
		const oauthState = await this.oauthStateRepository.findByExchangeCode(code);

		if (!oauthState) {
			this.#logger.warn(
				`Invalid or expired exchange code attempted: ${code.substring(0, 8)}...`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// 토큰이 저장되어 있는지 확인
		if (
			!oauthState.accessToken ||
			!oauthState.refreshToken ||
			!oauthState.userId
		) {
			this.#logger.error(
				`Exchange code found but tokens missing: OAuthState ID ${oauthState.id}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// 교환 완료 처리 (토큰 삭제)
		await this.oauthStateRepository.markAsExchanged(oauthState.id);

		this.#logger.debug(
			`Exchange code redeemed for user ${oauthState.userId}, OAuthState ID: ${oauthState.id}`,
		);

		return {
			accessToken: this.encryptionService.decryptSafe(oauthState.accessToken),
			refreshToken: this.encryptionService.decryptSafe(oauthState.refreshToken),
			userId: oauthState.userId,
			userName: oauthState.userName ?? undefined,
			profileImage: oauthState.profileImage ?? undefined,
			accountRestored: oauthState.accountRestored ?? undefined,
		};
	}
}

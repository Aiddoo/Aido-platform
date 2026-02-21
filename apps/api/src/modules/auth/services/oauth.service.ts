import { OAUTH_PROVIDERS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import { now } from "@/common/date";
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

// Apple, Google, Kakao, Naver OAuth 소셜 로그인 처리
@Injectable()
export class OAuthService {
	private readonly _logger = new Logger(OAuthService.name);
	private readonly _providers: Map<AccountProvider, IOAuthProviderStrategy>;

	constructor(
		private readonly _database: DatabaseService,
		private readonly _userRepository: UserRepository,
		private readonly _accountRepository: AccountRepository,
		private readonly _securityLogRepository: SecurityLogRepository,
		private readonly _loginAttemptRepository: LoginAttemptRepository,
		private readonly _oauthStateRepository: OAuthStateRepository,
		private readonly _sessionService: SessionService,
		private readonly _tokenVerifier: OAuthTokenVerifierService,
		private readonly _configService: TypedConfigService,
		private readonly _encryptionService: EncryptionService,
		private readonly _eventEmitter: EventEmitter2,
		private readonly _cacheService: CacheService,
	) {
		this._providers = new Map<AccountProvider, IOAuthProviderStrategy>([
			["APPLE", new AppleOAuthProvider(this._tokenVerifier)],
			[
				"GOOGLE",
				new GoogleOAuthProvider(
					() => this._configService.googleOAuth,
					this._tokenVerifier,
					this._logger,
				),
			],
			[
				"KAKAO",
				new KakaoOAuthProvider(
					() => this._configService.kakaoOAuth,
					this._tokenVerifier,
					this._logger,
				),
			],
			[
				"NAVER",
				new NaverOAuthProvider(
					() => this._configService.naverOAuth,
					this._tokenVerifier,
					this._logger,
				),
			],
		]);
	}

	private _getStrategy(provider: AccountProvider): IOAuthProviderStrategy {
		const strategy = this._providers.get(provider);
		if (!strategy) {
			throw BusinessExceptions.socialProviderError(provider, {
				reason: `Unsupported provider: ${provider}`,
			});
		}
		return strategy;
	}

	// 보안을 위한 화이트리스트 방식 검증 (환경별 분기)
	private get allowedRedirectPatterns(): RegExp[] {
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

		if (this._configService.isDevelopment) {
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

	private readonly DEFAULT_REDIRECT_URI = "aido://auth/callback";

	private validateRedirectUri(redirectUri?: string): string {
		if (!redirectUri) {
			return this.DEFAULT_REDIRECT_URI;
		}

		const isValid = this.allowedRedirectPatterns.some((pattern) =>
			pattern.test(redirectUri),
		);

		if (!isValid) {
			this._logger.warn(
				`Invalid redirect_uri rejected: ${redirectUri}. Using default.`,
			);
			return this.DEFAULT_REDIRECT_URI;
		}

		return redirectUri;
	}

	private async validateAndGetOAuthState(state: string): Promise<OAuthState> {
		const existingState = await this._oauthStateRepository.findByState(state);
		if (!existingState) {
			this._logger.warn(`Invalid OAuth state: ${state}`);
			throw BusinessExceptions.invalidCredentials();
		}
		return existingState;
	}

	async getRedirectUriByState(state: string): Promise<string | null> {
		const existingState = await this._oauthStateRepository.findByState(state);
		return existingState?.redirectUri ?? null;
	}

	// ============================================
	// Strategy 기반 통합 메서드
	// ============================================

	/**
	 * 모바일 로그인 통합 처리
	 *
	 * Provider 전략 클래스에 토큰 검증과 옵션 빌드를 위임하고,
	 * 공통 흐름(_handleSocialLogin, 실패 기록)을 관리합니다.
	 */
	private async _handleMobileLogin(
		provider: AccountProvider,
		token: string,
		userName?: string,
		metadata?: RequestMetadata,
		nonce?: string,
	): Promise<LoginResult> {
		const strategy = this._getStrategy(provider);
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
			const verifiedProfile = await strategy.verifyToken(token, nonce);
			const opts = strategy.buildLoginOptions(verifiedProfile, userName);

			return this._handleSocialLogin(
				provider,
				verifiedProfile.id,
				verifiedProfile.email ?? undefined,
				{ ...opts, metadata },
			);
		} catch (error) {
			await this._loginAttemptRepository.create({
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
	private async _generateAuthUrlWithState(
		provider: AccountProvider,
		state: string,
		clientRedirectUri?: string,
		mode?: OAuthMode,
		initiatingUserId?: string,
	): Promise<string> {
		const strategy = this._getStrategy(provider);
		const validatedRedirectUri = this.validateRedirectUri(clientRedirectUri);

		const persistState = (
			p: AccountProvider,
			redirectUri: string,
			opts: { mode?: OAuthMode; initiatingUserId?: string },
		) => this._oauthStateRepository.create(state, p, redirectUri, opts);

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
	private async _handleWebCallbackWithExchangeCode(
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
		const strategy = this._getStrategy(provider);
		const oauthState = await this.validateAndGetOAuthState(state);
		const redirectUri = oauthState.redirectUri || this.DEFAULT_REDIRECT_URI;

		const exchanged = await strategy.exchangeCode(code, state);
		if (!exchanged) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Linking 모드: 로그인 대신 providerAccountId만 추출하여 저장
		if (oauthState.mode === "link") {
			const verifiedProfile = await strategy.verifyToken(exchanged.token);
			const exchangeCode = await this._saveLinkingExchangeCode(
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
		const loginResult = await this._handleMobileLogin(
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
		return this._generateAuthUrlWithState(
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
		return this._generateAuthUrlWithState(
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
		return this._generateAuthUrlWithState(
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
		return this._handleWebCallbackWithExchangeCode(
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
		return this._handleWebCallbackWithExchangeCode(
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
		return this._handleWebCallbackWithExchangeCode(
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
		return this._handleMobileLogin("APPLE", idToken, userName, metadata, nonce);
	}

	async handleGoogleMobileLogin(
		idToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this._handleMobileLogin("GOOGLE", idToken, userName, metadata);
	}

	async handleKakaoMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this._handleMobileLogin("KAKAO", accessToken, userName, metadata);
	}

	async handleNaverMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		return this._handleMobileLogin("NAVER", accessToken, userName, metadata);
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
			await this._accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		if (existingAccount && existingAccount.userId !== userId) {
			throw this.getAlreadyLinkedExceptionForProvider(
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
			await this._database.$transaction(async (tx) => {
				await this._accountRepository.createOAuthAccount(
					{
						userId,
						provider,
						providerAccountId,
						refreshToken,
					},
					tx,
				);

				await this._securityLogRepository.create(
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
				throw this.getAlreadyLinkedExceptionForProvider(
					provider,
					providerAccountId,
				);
			}
			throw error;
		}

		this._logger.log(`Account linked: ${provider} for user ${userId}`);

		await this._cacheService.invalidateUserProfile(userId);

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
		const strategy = this._providers.get(provider);

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
		const account = await this._accountRepository.findByUserIdAndProvider(
			userId,
			provider,
		);

		if (!account) {
			throw BusinessExceptions.accountNotFound();
		}

		// 마지막 로그인 수단인지 확인
		const allAccounts = await this._accountRepository.findAllByUserId(userId);
		if (allAccounts.length <= 1) {
			throw BusinessExceptions.cannotUnlinkLastAccount();
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 계정 삭제 + 보안 로그 (트랜잭션)
		await this._database.$transaction(async (tx) => {
			await this._accountRepository.deleteAccount(userId, provider, tx);

			await this._securityLogRepository.create(
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

		this._logger.log(`Account unlinked: ${provider} for user ${userId}`);

		await this._cacheService.invalidateUserProfile(userId);

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
		const accounts = await this._accountRepository.findAllByUserId(userId);

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

	private async _handleSocialLogin(
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
			await this._accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		let userId: string;
		let userEmail: string;

		if (existingAccount) {
			// 기존 사용자 로그인
			userId = existingAccount.userId;
			const user = await this._userRepository.findById(userId);

			if (!user) {
				throw BusinessExceptions.userNotFound(userId);
			}

			// 탈퇴 사용자 로그인 차단
			if (user.deletedAt) {
				throw BusinessExceptions.accountDeleted(userId);
			}

			this._validateUserStatus(user.status);
			userEmail = user.email;

			this._logger.debug(`Existing ${provider} user login: ${userId}`);
		} else {
			// 신규 사용자
			// 이메일이 없는 경우 (카카오 등) 플레이스홀더 이메일 생성
			const effectiveEmail =
				email ??
				`${provider.toLowerCase()}_${providerAccountId}@social.aido.app`;

			// 이메일로 기존 사용자 확인 (실제 이메일인 경우에만)
			if (email) {
				const existingUser = await this._userRepository.findByEmail(email);
				if (existingUser) {
					// 이메일은 있지만 해당 소셜 계정이 연결되지 않은 경우
					// Provider별 자동 연동 또는 강제 연동 처리
					return this._handleEmailConflict(
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
			const newUser = await this._createSocialUser({
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

			this._logger.log(`New ${provider} user registered: ${userId}`);

			this._eventEmitter.emit(AdminNotificationEvents.USER_REGISTERED, {
				userId,
				email: effectiveEmail,
				provider:
					provider.toLowerCase() as UserRegisteredEventPayload["provider"],
				registeredAt: new Date().toISOString(),
			} satisfies UserRegisteredEventPayload);
		}

		// 세션 생성 및 토큰 발급
		return this._createSessionAndTokens(userId, userEmail, {
			ip,
			userAgent,
			provider,
		});
	}

	// emailVerified=true → ACTIVE, emailVerified=false → PENDING_VERIFY (로그인은 허용)
	private async _createSocialUser(data: {
		email: string;
		provider: AccountProvider;
		providerAccountId: string;
		userName?: string;
		emailVerified: boolean;
		refreshToken?: string;
		profileImage?: string;
	}) {
		return this._database.$transaction(async (tx) => {
			// User 생성 (소셜 로그인은 이메일 인증 상태에 따라 상태 결정)
			// - Apple/Google: emailVerified=true → ACTIVE
			// - Kakao/Naver: emailVerified 불확실 → PENDING_VERIFY 가능
			const user = await this._userRepository.create(
				{
					email: data.email,
					status: data.emailVerified ? "ACTIVE" : "PENDING_VERIFY",
					emailVerifiedAt: data.emailVerified ? now() : null,
				},
				tx,
			);

			// OAuth Account 연결
			await this._accountRepository.createOAuthAccount(
				{
					userId: user.id,
					provider: data.provider,
					providerAccountId: data.providerAccountId,
					refreshToken: data.refreshToken,
				},
				tx,
			);

			// 프로필 생성
			await this._userRepository.createProfile(
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
			await this._securityLogRepository.create(
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

	private async _createSessionAndTokens(
		userId: string,
		email: string,
		options: {
			ip: string;
			userAgent: string;
			provider: AccountProvider;
		},
	): Promise<LoginResult> {
		// 사용자 role 조회
		const user = await this._database.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		return this._database.$transaction(async (tx) => {
			const { sessionId, tokens } =
				await this._sessionService.createSessionWithTokens(
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
			await this._securityLogRepository.create(
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
			await this._loginAttemptRepository.create(
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
			const userWithProfile = await this._userRepository.findByIdWithProfile(
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

	// PENDING_VERIFY 허용: 소셜 로그인은 OAuth Provider가 신원을 이미 검증함
	private _validateUserStatus(status: string): void {
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

	private getAlreadyLinkedExceptionForProvider(
		provider: AccountProvider,
		providerAccountId: string,
	): BusinessException {
		const exceptionMap: Record<string, (id: string) => BusinessException> = {
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
	private _isTrustedProvider(provider: AccountProvider): boolean {
		return TRUSTED_EMAIL_PROVIDERS.includes(provider);
	}

	// Google/Apple: 자동 연동, Kakao/Naver: 강제 연동 필요 (에러 반환)
	private async _handleEmailConflict(
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
		// 탈퇴 사용자 차단
		if (existingUser.deletedAt) {
			throw BusinessExceptions.accountDeleted(existingUser.id);
		}

		const isTrusted = this._isTrustedProvider(provider);
		const isEmailVerified = options.emailVerified === true;

		if (isTrusted && isEmailVerified) {
			// 자동 연동: 신뢰된 Provider + 이메일 검증됨
			this._logger.log(
				`Auto-linking ${provider} account to existing user: ${existingUser.id}`,
			);

			// 사용자 상태 검증
			this._validateUserStatus(existingUser.status);

			// 트랜잭션으로 계정 연동 및 로그 기록
			await this._database.$transaction(async (tx) => {
				// OAuth Account 연결
				await this._accountRepository.createOAuthAccount(
					{
						userId: existingUser.id,
						provider,
						providerAccountId,
						refreshToken: options.appleRefreshToken,
					},
					tx,
				);

				// 보안 로그: 자동 연동
				await this._securityLogRepository.create(
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

			// 세션 생성 및 토큰 발급
			return this._createSessionAndTokens(existingUser.id, existingUser.email, {
				ip: options.ip,
				userAgent: options.userAgent,
				provider,
			});
		}

		// 강제 연동 필요: 신뢰되지 않은 Provider 또는 이메일 미검증
		this._logger.warn(
			`Manual linking required for ${provider} account to user: ${existingUser.id}`,
		);

		// 보안 로그: 연동 필요 알림
		await this._securityLogRepository.create({
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
	private async _saveLinkingExchangeCode(
		oauthStateId: number,
		provider: AccountProvider,
		providerAccountId: string,
	): Promise<string> {
		const exchangeCode = this._oauthStateRepository.generateExchangeCode();

		await this._oauthStateRepository.saveLinkingData(oauthStateId, {
			exchangeCode,
			provider,
			providerAccountId,
		});

		this._logger.debug(
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
		const oauthState =
			await this._oauthStateRepository.findByExchangeCode(code);

		if (!oauthState || oauthState.mode !== "link") {
			this._logger.warn(
				`Invalid or non-linking exchange code attempted: ${code.substring(0, 8)}...`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// initiatingUserId 검증: link 시작한 사용자만 교환 가능
		if (oauthState.initiatingUserId && oauthState.initiatingUserId !== userId) {
			this._logger.warn(
				`Linking user mismatch: expected ${oauthState.initiatingUserId}, got ${userId}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// providerAccountId는 saveLinkingData에서 userId 필드에 저장됨
		const provider = oauthState.provider;
		const providerAccountId = oauthState.userId;

		if (!providerAccountId) {
			this._logger.error(
				`Linking exchange code found but providerAccountId missing: OAuthState ID ${oauthState.id}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// 교환 완료 처리
		await this._oauthStateRepository.markAsExchanged(oauthState.id);

		this._logger.debug(
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
		userInfo: { userId: string; userName?: string; profileImage?: string },
	): Promise<string> {
		const exchangeCode = this._oauthStateRepository.generateExchangeCode();

		await this._oauthStateRepository.saveExchangeData(oauthStateId, {
			exchangeCode,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			userId: userInfo.userId,
			userName: userInfo.userName,
			profileImage: userInfo.profileImage,
		});

		this._logger.debug(
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
	}> {
		// 교환 코드로 OAuthState 조회 (미교환 + 미만료만)
		const oauthState =
			await this._oauthStateRepository.findByExchangeCode(code);

		if (!oauthState) {
			this._logger.warn(
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
			this._logger.error(
				`Exchange code found but tokens missing: OAuthState ID ${oauthState.id}`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

		// 교환 완료 처리 (토큰 삭제)
		await this._oauthStateRepository.markAsExchanged(oauthState.id);

		this._logger.debug(
			`Exchange code redeemed for user ${oauthState.userId}, OAuthState ID: ${oauthState.id}`,
		);

		return {
			accessToken: this._encryptionService.decryptSafe(oauthState.accessToken),
			refreshToken: this._encryptionService.decryptSafe(
				oauthState.refreshToken,
			),
			userId: oauthState.userId,
			userName: oauthState.userName ?? undefined,
			profileImage: oauthState.profileImage ?? undefined,
		};
	}
}

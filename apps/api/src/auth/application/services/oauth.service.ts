import { OAUTH_PROVIDERS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	AdminNotificationFacade,
	type UserRegisteredEventPayload,
} from "@/admin-notification";
import {
	OAUTH_IDENTITY_PROVIDER_REGISTRY,
	type OAuthIdentityProvider,
	type OAuthIdentityProviderRegistry,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type { LoginResult, RequestMetadata } from "@/auth/application/types";
import {
	ACCOUNT_DELETION,
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
	TRUSTED_EMAIL_PROVIDERS,
} from "@/auth/domain/constants/auth.constants";
import { generateRandomName } from "@/auth/domain/services/random-name.util";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { LoginAttemptRepository } from "@/auth/infrastructure/persistence/login-attempt.repository";
import {
	type OAuthMode,
	OAuthStateRepository,
} from "@/auth/infrastructure/persistence/oauth-state.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import {
	type AccountProvider,
	type OAuthState,
	Prisma,
} from "@/generated/prisma/client";
import {
	BusinessException,
	BusinessExceptions,
} from "@/shared/application/exceptions/business-exception.service";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import {
	toISOString,
	toISOStringOrNull,
} from "@/shared/domain/date/utils/format";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { EncryptionService } from "@/shared/infrastructure/encryption";
import { DEFAULT_CATEGORIES, TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import { IssueLoginUseCase } from "../use-cases/issue-login/issue-login.use-case";

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

@Injectable()
export class OAuthService {
	readonly #logger = new Logger(OAuthService.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly loginAttemptRepository: LoginAttemptRepository,
		private readonly oauthStateRepository: OAuthStateRepository,
		private readonly configService: TypedConfigService,
		private readonly encryptionService: EncryptionService,
		private readonly adminNotificationFacade: AdminNotificationFacade,
		private readonly cacheService: CacheService,
		private readonly userConsentRepository: UserConsentRepository,
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly todoCategoryRepository: TodoCategoryRepository,
		private readonly issueLoginUseCase: IssueLoginUseCase,
		@Inject(OAUTH_IDENTITY_PROVIDER_REGISTRY)
		private readonly registry: OAuthIdentityProviderRegistry,
	) {}

	#getStrategy(provider: AccountProvider): OAuthIdentityProvider {
		const strategy = this.registry.get(provider);
		if (!strategy) {
			throw BusinessExceptions.socialProviderError(provider, {
				reason: `Unsupported provider: ${provider}`,
			});
		}
		return strategy;
	}

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

		if (existingAccount) {
			return { message: "이미 연결된 계정입니다." };
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

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
		const strategy = this.registry.get(provider);

		if (!strategy) {
			throw BusinessExceptions.invalidCredentials();
		}

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
		const account = await this.accountRepository.findByUserIdAndProvider(
			userId,
			provider,
		);

		if (!account) {
			throw BusinessExceptions.accountNotFound();
		}

		const allAccounts = await this.accountRepository.findAllByUserId(userId);
		if (allAccounts.length <= 1) {
			throw BusinessExceptions.cannotUnlinkLastAccount();
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

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

	async getLinkedAccounts(userId: string): Promise<{
		accounts: {
			provider: (typeof OAUTH_PROVIDERS)[number];
			linked: boolean;
			providerAccountId: string | null;
			linkedAt: Date | null;
		}[];
		canUnlink: boolean;
	}> {
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

		const mappedAccounts = OAUTH_PROVIDERS.map((provider) => {
			const linked = linkedMap.get(provider);
			return {
				provider,
				linked: !!linked,
				providerAccountId: linked?.providerAccountId ?? null,
				linkedAt: linked?.linkedAt ?? null,
			};
		});

		return {
			accounts: mappedAccounts,
			canUnlink: accounts.length > 1,
		};
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

		const existingAccount =
			await this.accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		let userId: string;
		let userEmail: string;

		if (existingAccount) {
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
			const effectiveEmail =
				email ??
				`${provider.toLowerCase()}_${providerAccountId}@social.aido.kr`;

			if (email) {
				const existingUser = await this.userRepository.findByEmail(email);
				if (existingUser) {
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

			const newUser = await this.#createSocialUser({
				email: effectiveEmail,
				provider,
				providerAccountId,
				userName: options.userName,
				refreshToken: options.appleRefreshToken,
				profileImage: options.profileImage,
			});

			userId = newUser.id;
			userEmail = effectiveEmail;

			this.#logger.log(`New ${provider} user registered: ${userId}`);

			this.adminNotificationFacade.notifyUserRegistered({
				userId,
				email: effectiveEmail,
				provider: ACCOUNT_PROVIDER_TO_EVENT[provider],
				registeredAt: toISOString(now()),
			} satisfies UserRegisteredEventPayload);
		}

		return this.#createSessionAndTokens(userId, userEmail, {
			ip,
			userAgent,
			provider,
		});
	}

	// 소셜 로그인 유저는 OAuth Provider가 신원을 검증하므로 항상 ACTIVE
	async #createSocialUser(data: {
		email: string;
		provider: AccountProvider;
		providerAccountId: string;
		userName?: string;
		refreshToken?: string;
		profileImage?: string;
	}) {
		return this.database.$transaction(async (tx) => {
			const user = await this.userRepository.create(
				{
					email: data.email,
					status: "ACTIVE",
					emailVerifiedAt: now(),
				},
				tx,
			);

			await this.accountRepository.createOAuthAccount(
				{
					userId: user.id,
					provider: data.provider,
					providerAccountId: data.providerAccountId,
					refreshToken: data.refreshToken,
				},
				tx,
			);

			const MAX_NAME_LENGTH = 20;
			const effectiveName = data.userName
				? data.userName.slice(0, MAX_NAME_LENGTH)
				: generateRandomName();

			await this.userRepository.createProfile(
				user.id,
				{ name: effectiveName, profileImage: data.profileImage },
				tx,
			);

			const currentTime = now();
			await this.userConsentRepository.create(
				user.id,
				{
					termsAgreedAt: currentTime,
					privacyAgreedAt: currentTime,
					marketingAgreedAt: currentTime,
				},
				tx,
			);

			await this.userPreferenceRepository.create(
				user.id,
				{
					pushEnabled: true,
					nightPushEnabled: true,
				},
				tx,
			);

			await this.todoCategoryRepository.createMany(
				DEFAULT_CATEGORIES.map((category) => ({
					userId: user.id,
					name: category.name,
					color: category.color,
					sortOrder: category.sortOrder,
				})),
				tx,
			);

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
		const userRecord = await this.userRepository.findById(user.id);

		if (!userRecord) {
			throw BusinessExceptions.userNotFound(user.id);
		}

		const result = await this.database.$transaction(async (tx) => {
			await this.#restoreDeletedAccount(
				user,
				{ ip: options.ip, userAgent: options.userAgent },
				tx,
			);

			const outcome = await this.issueLoginUseCase.execute(
				{
					userId: user.id,
					email: user.email,
					role: userRecord.role,
					provider: options.provider,
					ip: options.ip,
					userAgent: options.userAgent,
					deviceFingerprint: options.userAgent,
					securityMetadata: { provider: options.provider },
				},
				tx,
			);

			return {
				userId: user.id,
				userTag: outcome.userTag,
				tokens: outcome.tokens,
				sessionId: outcome.sessionId,
				name: outcome.name,
				profileImage: outcome.profileImage,
			};
		});

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
		const user = await this.userRepository.findById(userId);

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		return this.database.$transaction(async (tx) => {
			const outcome = await this.issueLoginUseCase.execute(
				{
					userId,
					email,
					role: user.role,
					provider: options.provider,
					ip: options.ip,
					userAgent: options.userAgent,
					deviceFingerprint: options.userAgent,
					securityMetadata: { provider: options.provider },
				},
				tx,
			);

			return {
				userId,
				userTag: outcome.userTag,
				tokens: outcome.tokens,
				sessionId: outcome.sessionId,
				name: outcome.name,
				profileImage: outcome.profileImage,
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
		tx: TransactionClient,
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

	#validateUserStatus(status: string): void {
		switch (status) {
			case "LOCKED":
				throw BusinessExceptions.accountLocked("Social login user");
			case "SUSPENDED":
				throw BusinessExceptions.accountSuspended("Social login user");
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

	#isTrustedProvider(provider: AccountProvider): boolean {
		return TRUSTED_EMAIL_PROVIDERS.includes(provider);
	}

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

		if (oauthState?.mode !== "link") {
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

		await this.oauthStateRepository.markAsExchanged(oauthState.id);

		this.#logger.debug(
			`Linking exchange code redeemed for user ${userId}, provider ${provider}, OAuthState ID: ${oauthState.id}`,
		);

		return this.linkAccount(
			userId,
			provider,
			providerAccountId,
			undefined,
			metadata,
		);
	}

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

	async exchangeCodeForTokens(code: string): Promise<{
		accessToken: string;
		refreshToken: string;
		userId: string;
		userName?: string;
		profileImage?: string;
		accountRestored?: boolean;
	}> {
		const oauthState = await this.oauthStateRepository.findByExchangeCode(code);

		if (!oauthState) {
			this.#logger.warn(
				`Invalid or expired exchange code attempted: ${code.substring(0, 8)}...`,
			);
			throw BusinessExceptions.invalidCredentials();
		}

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

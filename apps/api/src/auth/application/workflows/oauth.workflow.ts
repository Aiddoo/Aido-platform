import { ErrorCode } from "@aido/errors";
import { OAUTH_PROVIDERS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	OAUTH_IDENTITY_PROVIDER_REGISTRY,
	type OAuthIdentityProvider,
	type OAuthIdentityProviderRegistry,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type { LoginResult, RequestMetadata } from "@/auth/application/types";
import {
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
	TRUSTED_EMAIL_PROVIDERS,
} from "@/auth/domain/constants/auth.constants";
import { assertRestorableWithinGracePeriod } from "@/auth/domain/services/account-restoration-policy";
import { assertStatusAllowsLogin } from "@/auth/domain/services/account-status-policy";
import { generateRandomName } from "@/auth/domain/services/random-name.util";
import type { AccountProvider } from "@/auth/domain/types";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import {
	toISOString,
	toISOStringOrNull,
} from "@/shared/domain/date/utils/format";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	AUTH_CACHE,
	AUTH_REGISTRATION_NOTIFIER,
	AUTH_RUNTIME_CONFIG,
	type AuthCachePort,
	type AuthRegistrationNotifierPort,
	type AuthRuntimeConfigPort,
	type AuthUserRegisteredNotification,
} from "../ports/auth-collaboration.port";
import {
	AUTH_ACCOUNT_REPOSITORY,
	AUTH_LOGIN_ATTEMPT_REPOSITORY,
	AUTH_OAUTH_STATE_REPOSITORY,
	AUTH_SECURITY_LOG_REPOSITORY,
	AUTH_USER_REPOSITORY,
	type AuthAccountRepositoryPort,
	type AuthLoginAttemptRepositoryPort,
	type AuthOAuthStateRepositoryPort,
	AuthPersistenceConflict,
	type AuthSecurityLogRepositoryPort,
	type AuthUserRepositoryPort,
} from "../ports/auth-persistence.port";
import type { OAuthMode } from "../ports/oauth-identity-provider.port";
import { IssueLoginUseCase } from "../use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "../use-cases/provision-user/provision-user.use-case";

/**
 * AccountProvider → 이벤트 페이로드 provider 매핑
 */
const ACCOUNT_PROVIDER_TO_EVENT: Record<
	AccountProvider,
	AuthUserRegisteredNotification["provider"]
> = {
	CREDENTIAL: "credential",
	APPLE: "apple",
	GOOGLE: "google",
	KAKAO: "kakao",
	NAVER: "naver",
};

@Injectable()
export class OAuthWorkflow {
	readonly #logger = new Logger(OAuthWorkflow.name);

	constructor(
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
		@Inject(AUTH_USER_REPOSITORY)
		private readonly userRepository: AuthUserRepositoryPort,
		@Inject(AUTH_ACCOUNT_REPOSITORY)
		private readonly accountRepository: AuthAccountRepositoryPort,
		@Inject(AUTH_SECURITY_LOG_REPOSITORY)
		private readonly securityLogRepository: AuthSecurityLogRepositoryPort,
		@Inject(AUTH_LOGIN_ATTEMPT_REPOSITORY)
		private readonly loginAttemptRepository: AuthLoginAttemptRepositoryPort,
		@Inject(AUTH_OAUTH_STATE_REPOSITORY)
		private readonly oauthStateRepository: AuthOAuthStateRepositoryPort,
		@Inject(AUTH_RUNTIME_CONFIG)
		private readonly configService: AuthRuntimeConfigPort,
		@Inject(AUTH_REGISTRATION_NOTIFIER)
		private readonly adminNotificationFacade: AuthRegistrationNotifierPort,
		@Inject(AUTH_CACHE) private readonly cacheService: AuthCachePort,
		private readonly issueLoginUseCase: IssueLoginUseCase,
		private readonly provisionUserUseCase: ProvisionUserUseCase,
		@Inject(OAUTH_IDENTITY_PROVIDER_REGISTRY)
		private readonly registry: OAuthIdentityProviderRegistry,
	) {}

	#getStrategy(provider: AccountProvider): OAuthIdentityProvider {
		const strategy = this.registry.get(provider);
		if (!strategy) {
			throw new ApplicationException(ErrorCode.SOCIAL_0204, {
				provider,
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

	async #validateAndGetOAuthState(state: string) {
		const existingState = await this.oauthStateRepository.findByState(state);
		if (!existingState) {
			this.#logger.warn(`Invalid OAuth state: ${state}`);
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0602);
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
			await this.uow.run(async () => {
				await this.accountRepository.createOAuthAccount({
					userId,
					provider,
					providerAccountId,
					refreshToken,
				});

				await this.securityLogRepository.create({
					userId,
					event: SECURITY_EVENT.OAUTH_LINKED,
					ipAddress: ip,
					userAgent,
					metadata: { provider, providerAccountId },
				});
			});
		} catch (error) {
			if (
				error instanceof AuthPersistenceConflict &&
				error.kind === "OAUTH_ACCOUNT_ALREADY_LINKED"
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
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		const token = idToken ?? accessToken;
		if (!token) {
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0603, {
				provider: undefined,
			});
		}

		const allAccounts = await this.accountRepository.findAllByUserId(userId);
		if (allAccounts.length <= 1) {
			throw new ApplicationException(ErrorCode.USER_0610);
		}

		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		await this.uow.run(async () => {
			await this.accountRepository.deleteAccount(userId, provider);

			await this.securityLogRepository.create({
				userId,
				event: SECURITY_EVENT.OAUTH_UNLINKED,
				ipAddress: ip,
				userAgent,
				metadata: { provider },
			});
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
				throw new ApplicationException(ErrorCode.USER_0601, { userId });
			}

			// 탈퇴 사용자: 유예 기간 내 복구 또는 차단(도메인 정책이 소유)
			if (assertRestorableWithinGracePeriod(user.deletedAt, userId)) {
				// 30일 이내 — 복구 + 세션 생성을 원자적으로 처리
				const loginResult = await this.#restoreAndCreateSession(user, {
					ip,
					userAgent,
					provider,
				});
				return { ...loginResult, accountRestored: true };
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
			} satisfies AuthUserRegisteredNotification);
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
		return this.uow.run(async () => {
			const MAX_NAME_LENGTH = 20;
			const effectiveName = data.userName
				? data.userName.slice(0, MAX_NAME_LENGTH)
				: generateRandomName();
			const currentTime = now();

			// User + OAuth 계정 + 프로필 + 동의 + 푸시설정 + 기본 카테고리 프로비저닝
			// (이메일 회원가입과 공유하는 수렴 시퀀스)
			const user = await this.provisionUserUseCase.execute({
				email: data.email,
				status: "ACTIVE",
				emailVerifiedAt: now(),
				account: {
					kind: "oauth",
					provider: data.provider,
					providerAccountId: data.providerAccountId,
					refreshToken: data.refreshToken,
				},
				profile: { name: effectiveName, profileImage: data.profileImage },
				consent: {
					termsAgreedAt: currentTime,
					privacyAgreedAt: currentTime,
					// OAuth 가입 시 선택 동의 화면이 없으므로 마케팅 동의를 자동 처리하지 않는다.
				},
			});

			await this.securityLogRepository.create({
				userId: user.id,
				event: SECURITY_EVENT.REGISTRATION,
				ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
				userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
				metadata: { provider: data.provider },
			});

			return user;
		});
	}

	/**
	 * 탈퇴 계정 복구 + 세션 생성을 원자적 트랜잭션으로 수행
	 *
	 * 복구와 세션 생성이 하나의 트랜잭션으로 묶여,
	 * 세션 생성 실패 시 복구도 롤백됩니다.
	 */
	/**
	 * 신뢰 Provider 자동 연동: OAuth 계정 생성 + 보안 로그 기록.
	 *
	 * 순수 DB write만 수행하므로 호출측이 연 트랜잭션(CLS)에 참여한다.
	 * 세션 생성·복구와 하나의 트랜잭션으로 원자적으로 묶여 실행된다.
	 */
	async #linkOAuthAccount(
		userId: string,
		provider: AccountProvider,
		providerAccountId: string,
		options: { ip: string; userAgent: string; appleRefreshToken?: string },
	): Promise<void> {
		await this.accountRepository.createOAuthAccount({
			userId,
			provider,
			providerAccountId,
			refreshToken: options.appleRefreshToken,
		});

		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
			ipAddress: options.ip,
			userAgent: options.userAgent,
			metadata: {
				provider,
				autoLinked: true,
				reason: "trusted_provider_verified_email",
			},
		});
	}

	/**
	 * 탈퇴 계정 복구 + 로그인 세션 생성.
	 *
	 * @param onLinkInTransaction 커밋 전(트랜잭션 내부)에 실행할 추가 작업.
	 *   자동 연동 경로에서 OAuth 계정 연동을 같은 트랜잭션에 참여시켜 복구·세션·연동을
	 *   원자적으로 처리하기 위해 사용한다. 캐시 무효화는 커밋 후 수행된다.
	 */
	async #restoreAndCreateSession(
		user: { id: string; email: string; deletedAt: Date | null },
		options: { ip: string; userAgent: string; provider: AccountProvider },
		onLinkInTransaction?: () => Promise<void>,
	): Promise<LoginResult> {
		const userRecord = await this.userRepository.findById(user.id);

		if (!userRecord) {
			throw new ApplicationException(ErrorCode.USER_0601, { userId: user.id });
		}

		const result = await this.uow.run(async () => {
			await this.#restoreDeletedAccount(user, {
				ip: options.ip,
				userAgent: options.userAgent,
			});

			const outcome = await this.issueLoginUseCase.execute({
				userId: user.id,
				email: user.email,
				role: userRecord.role,
				provider: options.provider,
				ip: options.ip,
				userAgent: options.userAgent,
				deviceFingerprint: options.userAgent,
				securityMetadata: { provider: options.provider },
			});

			if (onLinkInTransaction) {
				await onLinkInTransaction();
			}

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
			throw new ApplicationException(ErrorCode.USER_0601, { userId });
		}

		return this.uow.run(async () => {
			const outcome = await this.issueLoginUseCase.execute({
				userId,
				email,
				role: user.role,
				provider: options.provider,
				ip: options.ip,
				userAgent: options.userAgent,
				deviceFingerprint: options.userAgent,
				securityMetadata: { provider: options.provider },
			});

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
	): Promise<void> {
		await this.userRepository.restore(user.id);

		await this.securityLogRepository.create({
			userId: user.id,
			event: SECURITY_EVENT.ACCOUNT_RESTORED,
			ipAddress: metadata.ip,
			userAgent: metadata.userAgent,
			metadata: {
				deletedAt: toISOStringOrNull(user.deletedAt ?? null),
				restoredAt: toISOString(now()),
			},
		});
	}

	#validateUserStatus(status: string): void {
		assertStatusAllowsLogin(status, "Social login user");
	}

	#getAlreadyLinkedExceptionForProvider(
		provider: AccountProvider,
		providerAccountId: string,
	): ApplicationException {
		const exceptionMap: Partial<
			Record<AccountProvider, (id: string) => ApplicationException>
		> = {
			KAKAO: (kakaoId) =>
				new ApplicationException(ErrorCode.KAKAO_0306, { kakaoId }),
			APPLE: (appleId) =>
				new ApplicationException(ErrorCode.APPLE_0355, { appleId }),
			GOOGLE: (googleId) =>
				new ApplicationException(ErrorCode.GOOGLE_0405, { googleId }),
			NAVER: (naverId) =>
				new ApplicationException(ErrorCode.NAVER_0455, { naverId }),
		};
		const factory = exceptionMap[provider];
		return factory
			? factory(providerAccountId)
			: new ApplicationException(ErrorCode.USER_0604, {
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
		// 탈퇴 사용자: 유예 기간 내 복구 또는 차단(도메인 정책이 소유)
		// 유예 기간 이내면 needsRestore=true(아래에서 트랜잭션 내 복구), 초과면 USER_0606
		const needsRestore = assertRestorableWithinGracePeriod(
			existingUser.deletedAt,
			existingUser.id,
		);

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
				// 복구 + 연동 + 세션 생성을 하나의 트랜잭션으로 원자적으로 수행한다.
				// 연동(createOAuthAccount+보안로그)이 실패하면 복구·세션도 함께 롤백되어
				// "복구·로그인됐지만 계정 미연동"인 불일치 상태가 남지 않는다.
				// 프로필 캐시 무효화는 커밋 후 수행되도록 #restoreAndCreateSession이 보장한다.
				const loginResult = await this.#restoreAndCreateSession(
					existingUser,
					{ ip: options.ip, userAgent: options.userAgent, provider },
					() =>
						this.#linkOAuthAccount(
							existingUser.id,
							provider,
							providerAccountId,
							{
								ip: options.ip,
								userAgent: options.userAgent,
								appleRefreshToken: options.appleRefreshToken,
							},
						),
				);

				return { ...loginResult, accountRestored: true };
			}

			// 연동 + 세션 생성을 하나의 트랜잭션으로 원자적으로 수행한다.
			// IssueLoginUseCase는 호출측 트랜잭션에 참여하는 순수 DB write이므로
			// (커밋 후 enqueue/캐시 등 부수효과 없음) 안전하게 한 트랜잭션으로 묶인다.
			return this.uow.run(async () => {
				await this.#linkOAuthAccount(
					existingUser.id,
					provider,
					providerAccountId,
					{
						ip: options.ip,
						userAgent: options.userAgent,
						appleRefreshToken: options.appleRefreshToken,
					},
				);

				return this.#createSessionAndTokens(
					existingUser.id,
					existingUser.email,
					{ ip: options.ip, userAgent: options.userAgent, provider },
				);
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

		throw new ApplicationException(ErrorCode.SOCIAL_0206, {
			provider,
			providerAccountId,
			email: existingUser.email,
		});
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
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		// initiatingUserId 검증: link 시작한 사용자만 교환 가능
		if (oauthState.initiatingUserId && oauthState.initiatingUserId !== userId) {
			this.#logger.warn(
				`Linking user mismatch: expected ${oauthState.initiatingUserId}, got ${userId}`,
			);
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		// providerAccountId는 saveLinkingData에서 userId 필드에 저장됨
		const provider = oauthState.provider;
		const providerAccountId = oauthState.userId;

		if (!providerAccountId) {
			this.#logger.error(
				`Linking exchange code found but providerAccountId missing: OAuthState ID ${oauthState.id}`,
			);
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		if (
			!oauthState.accessToken ||
			!oauthState.refreshToken ||
			!oauthState.userId
		) {
			this.#logger.error(
				`Exchange code found but tokens missing: OAuthState ID ${oauthState.id}`,
			);
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		await this.oauthStateRepository.markAsExchanged(oauthState.id);

		this.#logger.debug(
			`Exchange code redeemed for user ${oauthState.userId}, OAuthState ID: ${oauthState.id}`,
		);

		return {
			accessToken: oauthState.accessToken,
			refreshToken: oauthState.refreshToken,
			userId: oauthState.userId,
			userName: oauthState.userName ?? undefined,
			profileImage: oauthState.profileImage ?? undefined,
			accountRestored: oauthState.accountRestored ?? undefined,
		};
	}
}

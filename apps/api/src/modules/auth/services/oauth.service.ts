import { Injectable, Logger } from "@nestjs/common";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { AccountProvider } from "@/generated/prisma/client";

import { AUTH_DEFAULTS, SECURITY_EVENT } from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import type { LoginResult, RequestMetadata } from "../types";
import { OAuthTokenVerifierService } from "./oauth-token-verifier.service";
import { TokenService } from "./token.service";

/**
 * OAuth 소셜 로그인 서비스
 *
 * Apple, Google, Kakao, Naver OAuth 제공자를 통한 소셜 로그인을 처리합니다.
 * 모바일 앱에서 받은 토큰을 서버에서 검증하고, 사용자 생성/조회 및 세션 발급을 담당합니다.
 */
@Injectable()
export class OAuthService {
	private readonly _logger = new Logger(OAuthService.name);

	constructor(
		private readonly _database: DatabaseService,
		private readonly _userRepository: UserRepository,
		private readonly _accountRepository: AccountRepository,
		private readonly _sessionRepository: SessionRepository,
		private readonly _securityLogRepository: SecurityLogRepository,
		private readonly _tokenService: TokenService,
		private readonly _tokenVerifier: OAuthTokenVerifierService,
	) {}

	/**
	 * Apple 모바일 로그인 처리 (서버에서 토큰 검증)
	 *
	 * 클라이언트에서 받은 idToken을 서버에서 JWKS로 직접 검증합니다.
	 * 클라이언트가 제공하는 profile 객체를 신뢰하지 않습니다.
	 *
	 * @param idToken - Apple에서 발급받은 ID Token
	 * @param userName - 사용자 이름 (첫 로그인 시에만 제공)
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 */
	async handleAppleMobileLogin(
		idToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		// 서버에서 토큰 검증
		const verifiedProfile = await this._tokenVerifier.verifyAppleToken(idToken);

		return this._handleSocialLogin(
			"APPLE",
			verifiedProfile.id,
			verifiedProfile.email ?? undefined,
			{
				userName,
				emailVerified: verifiedProfile.emailVerified,
				metadata,
			},
		);
	}

	/**
	 * Google 모바일 로그인 처리 (서버에서 토큰 검증)
	 *
	 * 클라이언트에서 받은 idToken을 서버에서 google-auth-library로 직접 검증합니다.
	 * 클라이언트가 제공하는 profile 객체를 신뢰하지 않습니다.
	 *
	 * @param idToken - Google에서 발급받은 ID Token
	 * @param userName - 사용자 이름 (프로필 이름 대신 사용할 경우)
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 */
	async handleGoogleMobileLogin(
		idToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		// 서버에서 토큰 검증
		const verifiedProfile =
			await this._tokenVerifier.verifyGoogleToken(idToken);

		// 검증된 프로필에서 이름 사용 (userName이 제공되지 않은 경우)
		const finalUserName = userName ?? verifiedProfile.name;

		return this._handleSocialLogin(
			"GOOGLE",
			verifiedProfile.id,
			verifiedProfile.email ?? undefined,
			{
				userName: finalUserName,
				emailVerified: verifiedProfile.emailVerified,
				profileImage: verifiedProfile.picture,
				metadata,
			},
		);
	}

	/**
	 * Kakao 모바일 로그인 처리 (서버에서 토큰 검증)
	 *
	 * 클라이언트에서 받은 accessToken으로 Kakao API를 호출하여 사용자 정보를 검증합니다.
	 * 클라이언트가 제공하는 profile 객체를 신뢰하지 않습니다.
	 *
	 * @param accessToken - Kakao에서 발급받은 Access Token
	 * @param userName - 사용자 이름 (프로필 이름 대신 사용할 경우)
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 */
	async handleKakaoMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		// 서버에서 토큰 검증
		const verifiedProfile =
			await this._tokenVerifier.verifyKakaoToken(accessToken);

		// 검증된 프로필에서 이름 사용 (userName이 제공되지 않은 경우)
		const finalUserName = userName ?? verifiedProfile.name;

		return this._handleSocialLogin(
			"KAKAO",
			verifiedProfile.id,
			verifiedProfile.email ?? undefined,
			{
				userName: finalUserName,
				emailVerified: verifiedProfile.emailVerified,
				profileImage: verifiedProfile.picture,
				metadata,
			},
		);
	}

	/**
	 * Naver 모바일 로그인 처리 (서버에서 토큰 검증)
	 *
	 * 클라이언트에서 받은 accessToken으로 Naver API를 호출하여 사용자 정보를 검증합니다.
	 * 클라이언트가 제공하는 profile 객체를 신뢰하지 않습니다.
	 *
	 * @param accessToken - Naver에서 발급받은 Access Token
	 * @param userName - 사용자 이름 (프로필 이름 대신 사용할 경우)
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 */
	async handleNaverMobileLogin(
		accessToken: string,
		userName?: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		// 서버에서 토큰 검증
		const verifiedProfile =
			await this._tokenVerifier.verifyNaverToken(accessToken);

		// 검증된 프로필에서 이름 사용 (userName이 제공되지 않은 경우)
		const finalUserName = userName ?? verifiedProfile.name;

		return this._handleSocialLogin(
			"NAVER",
			verifiedProfile.id,
			verifiedProfile.email ?? undefined,
			{
				userName: finalUserName,
				emailVerified: verifiedProfile.emailVerified,
				profileImage: verifiedProfile.picture,
				metadata,
			},
		);
	}

	/**
	 * 계정 연결 (로그인된 사용자에 소셜 계정 추가)
	 *
	 * @param userId - 현재 로그인한 사용자 ID
	 * @param provider - OAuth 제공자
	 * @param providerAccountId - 제공자 고유 사용자 ID
	 * @param refreshToken - OAuth refresh token (선택)
	 */
	async linkAccount(
		userId: string,
		provider: AccountProvider,
		providerAccountId: string,
		refreshToken?: string,
	): Promise<{ message: string }> {
		// 이미 다른 사용자에 연결되었는지 확인
		const existingAccount =
			await this._accountRepository.findByProviderAccountId(
				provider,
				providerAccountId,
			);

		if (existingAccount && existingAccount.userId !== userId) {
			throw BusinessExceptions.appleAccountAlreadyLinked(providerAccountId);
		}

		// 이미 연결된 경우
		if (existingAccount) {
			return { message: "이미 연결된 계정입니다." };
		}

		// 계정 연결
		await this._accountRepository.createOAuthAccount({
			userId,
			provider,
			providerAccountId,
			refreshToken,
		});

		this._logger.log(`Account linked: ${provider} for user ${userId}`);

		return { message: "계정이 연결되었습니다." };
	}

	/**
	 * 토큰 검증 후 소셜 계정 연동
	 *
	 * 클라이언트에서 받은 토큰을 서버에서 검증한 후 계정을 연동합니다.
	 *
	 * @param userId - 현재 로그인한 사용자 ID
	 * @param dto - 연동 요청 데이터 (provider, idToken/accessToken)
	 */
	async linkSocialAccountWithToken(
		userId: string,
		dto: {
			provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER";
			idToken?: string;
			accessToken?: string;
		},
	): Promise<{ message: string }> {
		const { provider, idToken, accessToken } = dto;
		let providerAccountId: string;

		// 토큰 검증하여 providerAccountId 추출
		switch (provider) {
			case "APPLE": {
				if (!idToken) {
					throw BusinessExceptions.invalidCredentials();
				}
				const appleProfile =
					await this._tokenVerifier.verifyAppleToken(idToken);
				providerAccountId = appleProfile.id;
				break;
			}
			case "GOOGLE": {
				if (!idToken) {
					throw BusinessExceptions.invalidCredentials();
				}
				const googleProfile =
					await this._tokenVerifier.verifyGoogleToken(idToken);
				providerAccountId = googleProfile.id;
				break;
			}
			case "KAKAO": {
				if (!accessToken) {
					throw BusinessExceptions.invalidCredentials();
				}
				const kakaoProfile =
					await this._tokenVerifier.verifyKakaoToken(accessToken);
				providerAccountId = kakaoProfile.id;
				break;
			}
			case "NAVER": {
				if (!accessToken) {
					throw BusinessExceptions.invalidCredentials();
				}
				const naverProfile =
					await this._tokenVerifier.verifyNaverToken(accessToken);
				providerAccountId = naverProfile.id;
				break;
			}
			default:
				throw BusinessExceptions.invalidCredentials();
		}

		// 검증된 providerAccountId로 계정 연동
		return this.linkAccount(userId, provider, providerAccountId);
	}

	/**
	 * 계정 연결 해제
	 *
	 * @param userId - 현재 로그인한 사용자 ID
	 * @param provider - OAuth 제공자
	 */
	async unlinkAccount(
		userId: string,
		provider: AccountProvider,
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

		// 계정 삭제
		await this._accountRepository.deleteAccount(userId, provider);

		this._logger.log(`Account unlinked: ${provider} for user ${userId}`);

		return { message: "계정 연결이 해제되었습니다." };
	}

	/**
	 * 연결된 계정 목록 조회
	 */
	async getLinkedAccounts(
		userId: string,
	): Promise<{ provider: AccountProvider; linkedAt: Date }[]> {
		const accounts = await this._accountRepository.findAllByUserId(userId);

		return accounts
			.filter((account) => account.provider !== "CREDENTIAL")
			.map((account) => ({
				provider: account.provider,
				linkedAt: account.createdAt,
			}));
	}

	/**
	 * 소셜 로그인 공통 처리
	 */
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

			this._validateUserStatus(user.status);
			userEmail = user.email;

			this._logger.debug(`Existing ${provider} user login: ${userId}`);
		} else {
			// 신규 사용자 - 이메일 필수
			if (!email) {
				throw BusinessExceptions.socialEmailNotProvided(provider);
			}

			// 이메일로 기존 사용자 확인
			const existingUser = await this._userRepository.findByEmail(email);
			if (existingUser) {
				// 이메일은 있지만 해당 소셜 계정이 연결되지 않은 경우
				throw BusinessExceptions.socialAccountNotLinked(provider);
			}

			// 신규 회원가입
			const newUser = await this._createSocialUser({
				email,
				provider,
				providerAccountId,
				userName: options.userName,
				emailVerified: options.emailVerified ?? false,
				refreshToken: options.appleRefreshToken,
				profileImage: options.profileImage,
			});

			userId = newUser.id;
			userEmail = email;

			this._logger.log(`New ${provider} user registered: ${userId}`);
		}

		// 세션 생성 및 토큰 발급
		return this._createSessionAndTokens(userId, userEmail, {
			ip,
			userAgent,
			provider,
		});
	}

	/**
	 * 소셜 사용자 생성 (트랜잭션)
	 */
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
			const user = await this._userRepository.create(
				{
					email: data.email,
					status: data.emailVerified ? "ACTIVE" : "PENDING_VERIFY",
					emailVerifiedAt: data.emailVerified ? new Date() : null,
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
			const now = new Date();
			await tx.userConsent.create({
				data: {
					userId: user.id,
					termsAgreedAt: now,
					privacyAgreedAt: now,
					marketingAgreedAt: null,
				},
			});

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

	/**
	 * 세션 생성 및 토큰 발급
	 */
	private async _createSessionAndTokens(
		userId: string,
		email: string,
		options: {
			ip: string;
			userAgent: string;
			provider: AccountProvider;
		},
	): Promise<LoginResult> {
		return this._database.$transaction(async (tx) => {
			// 토큰 패밀리 생성
			const tokenFamily = this._tokenService.generateTokenFamily();

			// 세션 만료 시간
			const expiresInSeconds =
				this._tokenService.getRefreshTokenExpiresInSeconds();
			const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

			// 세션 생성
			const session = await this._sessionRepository.create(
				{
					userId,
					tokenFamily,
					tokenVersion: 1,
					deviceFingerprint: options.userAgent,
					userAgent: options.userAgent,
					ipAddress: options.ip,
					expiresAt,
				},
				tx,
			);

			// 토큰 발급
			const tokens = await this._tokenService.generateTokenPair(
				userId,
				email,
				session.id,
				tokenFamily,
				1,
			);

			// 리프레시 토큰 해시 업데이트
			const refreshTokenHash = this._tokenService.hashRefreshToken(
				tokens.refreshToken,
			);
			await this._sessionRepository.updateRefreshTokenHash(
				session.id,
				refreshTokenHash,
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

			// 프로필 조회
			const userWithProfile = await this._userRepository.findByIdWithProfile(
				userId,
				tx,
			);

			return {
				userId,
				tokens,
				sessionId: session.id,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});
	}

	/**
	 * 사용자 상태 검증
	 */
	private _validateUserStatus(status: string): void {
		switch (status) {
			case "LOCKED":
				throw BusinessExceptions.accountLocked("Social login user");
			case "SUSPENDED":
				throw BusinessExceptions.accountSuspended("Social login user");
			case "PENDING_VERIFY":
				// 소셜 로그인은 이메일 미인증 상태도 허용 (Apple은 이메일 인증됨)
				break;
			default:
				break;
		}
	}
}

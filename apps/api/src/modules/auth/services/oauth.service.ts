import { Injectable, Logger } from "@nestjs/common";
import { TypedConfigService } from "@/common/config/services/config.service";
import { addMilliseconds, now } from "@/common/date";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { AccountProvider } from "@/generated/prisma/client";

import {
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
	TRUSTED_EMAIL_PROVIDERS,
} from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { OAuthStateRepository } from "../repositories/oauth-state.repository";
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
		private readonly _loginAttemptRepository: LoginAttemptRepository,
		private readonly _oauthStateRepository: OAuthStateRepository,
		private readonly _tokenService: TokenService,
		private readonly _tokenVerifier: OAuthTokenVerifierService,
		private readonly _configService: TypedConfigService,
	) {}

	/**
	 * 허용된 Redirect URI 패턴 목록
	 * 보안을 위해 화이트리스트 방식으로 검증합니다.
	 */
	private readonly ALLOWED_REDIRECT_PATTERNS = [
		// 모바일 앱 딥링크 (기본값)
		/^aido:\/\/auth\/callback$/,
		// aido.kr 도메인 (프로덕션)
		/^https:\/\/aido\.kr(\/.*)?$/,
		// aido.kr 서브도메인
		/^https:\/\/[a-z0-9-]+\.aido\.kr(\/.*)?$/,
		// 로컬 개발 환경
		/^http:\/\/localhost(:\d+)?(\/.*)?$/,
		// Expo Go 개발 환경 (exp:// scheme)
		/^exp:\/\/[\d.:]+(\/.*)?$/,
	];

	/**
	 * 기본 Redirect URI (모바일 앱)
	 */
	private readonly DEFAULT_REDIRECT_URI = "aido://auth/callback";

	/**
	 * Redirect URI 유효성 검증
	 *
	 * 보안을 위해 화이트리스트 패턴만 허용합니다.
	 *
	 * @param redirectUri - 검증할 Redirect URI
	 * @returns 유효한 Redirect URI 또는 기본값
	 */
	private validateRedirectUri(redirectUri?: string): string {
		if (!redirectUri) {
			return this.DEFAULT_REDIRECT_URI;
		}

		const isValid = this.ALLOWED_REDIRECT_PATTERNS.some((pattern) =>
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

	/**
	 * Kakao OAuth 인증 URL 생성 (웹 브라우저 기반 OAuth 플로우용)
	 *
	 * 모바일 앱에서 WebBrowser.openAuthSessionAsync()로 열어
	 * 카카오 인증 페이지로 리다이렉트합니다.
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @returns Kakao OAuth 인증 URL
	 * @deprecated generateKakaoAuthUrlWithState 사용을 권장합니다.
	 */
	generateKakaoAuthUrl(state: string): string {
		const { clientId, callbackUrl, isConfigured } =
			this._configService.kakaoOAuth;

		if (!isConfigured || !clientId || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl,
			response_type: "code",
			state,
			scope: "profile_nickname profile_image",
		});

		return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
	}

	/**
	 * Kakao OAuth 인증 URL 생성 및 State 저장
	 *
	 * 클라이언트가 지정한 redirect_uri를 DB에 저장하여
	 * 콜백 시 해당 URI로 리다이렉트할 수 있도록 합니다.
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @param clientRedirectUri - 클라이언트가 지정한 Redirect URI (선택)
	 * @returns Kakao OAuth 인증 URL
	 */
	async generateKakaoAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
	): Promise<string> {
		const { clientId, callbackUrl, isConfigured } =
			this._configService.kakaoOAuth;

		if (!isConfigured || !clientId || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Redirect URI 검증 (화이트리스트)
		const validatedRedirectUri = this.validateRedirectUri(clientRedirectUri);

		// OAuthState 생성 (redirect_uri 저장)
		await this._oauthStateRepository.create(
			state,
			"KAKAO",
			validatedRedirectUri,
		);

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl, // 카카오에는 백엔드 콜백 URL 전달
			response_type: "code",
			state,
			scope: "profile_nickname profile_image",
		});

		return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
	}

	/**
	 * Kakao 웹 OAuth 콜백 처리 (Authorization Code → Access Token 교환)
	 *
	 * 카카오에서 리다이렉트된 authorization code를 access token으로 교환하고,
	 * 사용자 정보를 검증한 후 세션을 생성합니다.
	 *
	 * @param code - Kakao에서 받은 authorization code
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 로그인 결과 (토큰, 사용자 정보)
	 */
	async handleKakaoWebCallback(
		code: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		const { clientId, clientSecret, callbackUrl, isConfigured } =
			this._configService.kakaoOAuth;

		if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Authorization Code → Access Token 교환
		const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: callbackUrl,
				code,
			}).toString(),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			this._logger.error(`Kakao token exchange failed: ${errorData}`);
			throw BusinessExceptions.invalidCredentials();
		}

		const tokenData = (await tokenResponse.json()) as {
			access_token: string;
			token_type: string;
			refresh_token: string;
			expires_in: number;
		};

		// Access Token으로 사용자 정보 검증 및 로그인 처리
		return this.handleKakaoMobileLogin(
			tokenData.access_token,
			undefined,
			metadata,
		);
	}

	/**
	 * Kakao 웹 OAuth 콜백 처리 + 교환 코드 생성
	 *
	 * 카카오에서 리다이렉트된 authorization code를 처리하고,
	 * JWT 토큰을 DB에 임시 저장한 후 일회용 교환 코드를 반환합니다.
	 * 딥링크 URL에 토큰이 노출되지 않도록 보안을 강화합니다.
	 *
	 * @param code - Kakao에서 받은 authorization code
	 * @param state - CSRF 방지용 상태 값
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 교환 코드 및 사용자 정보
	 */
	async handleKakaoWebCallbackWithExchangeCode(
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
		// state로 기존 OAuthState 조회 (generateKakaoAuthUrlWithState에서 생성됨)
		const existingState = await this._oauthStateRepository.findByState(state);

		// 기존 로직으로 토큰 생성
		const loginResult = await this.handleKakaoWebCallback(code, metadata);

		let oauthState: Awaited<
			ReturnType<typeof this._oauthStateRepository.create>
		>;
		let redirectUri: string;

		if (existingState) {
			// 기존 state가 있으면 사용
			oauthState = existingState;
			redirectUri = existingState.redirectUri || this.DEFAULT_REDIRECT_URI;
		} else {
			// 레거시 호환: state가 없으면 새로 생성 (직접 callback URL 호출 시)
			this._logger.warn(
				`OAuthState not found for state: ${state}, creating new one`,
			);
			oauthState = await this._oauthStateRepository.create(
				state,
				"KAKAO",
				this.DEFAULT_REDIRECT_URI,
			);
			redirectUri = this.DEFAULT_REDIRECT_URI;
		}

		// 교환 코드 생성 및 토큰 저장
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

	// ========================================
	// Google 웹 OAuth
	// ========================================

	/**
	 * Google 웹 OAuth 인증 URL 생성
	 *
	 * state를 저장하고 Google OAuth 인증 페이지로 리다이렉트할 URL을 생성합니다.
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @param clientRedirectUri - 클라이언트 리다이렉트 URI (딥링크)
	 * @returns Google OAuth 인증 URL
	 */
	async generateGoogleAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
	): Promise<string> {
		const { clientId, callbackUrl, isConfigured } =
			this._configService.googleOAuth;

		if (!isConfigured || !clientId || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Redirect URI 검증 (화이트리스트)
		const validatedRedirectUri = this.validateRedirectUri(clientRedirectUri);

		// OAuthState 생성 (redirect_uri 저장)
		await this._oauthStateRepository.create(
			state,
			"GOOGLE",
			validatedRedirectUri,
		);

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl, // 구글에는 백엔드 콜백 URL 전달
			response_type: "code",
			state,
			scope: "openid email profile",
			access_type: "offline",
			prompt: "consent",
		});

		return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
	}

	/**
	 * Google 웹 OAuth 콜백 처리 (Authorization Code → Access Token 교환)
	 *
	 * 구글에서 리다이렉트된 authorization code를 access token으로 교환하고,
	 * 사용자 정보를 검증한 후 세션을 생성합니다.
	 *
	 * @param code - Google에서 받은 authorization code
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 로그인 결과 (토큰, 사용자 정보)
	 */
	async handleGoogleWebCallback(
		code: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		const { clientId, clientSecret, callbackUrl, isConfigured } =
			this._configService.googleOAuth;

		if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Authorization Code → Access Token 교환
		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: callbackUrl,
				code,
			}).toString(),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			this._logger.error(`Google token exchange failed: ${errorData}`);
			throw BusinessExceptions.invalidCredentials();
		}

		const tokenData = (await tokenResponse.json()) as {
			access_token: string;
			id_token: string;
			token_type: string;
			refresh_token?: string;
			expires_in: number;
		};

		// ID Token으로 사용자 정보 검증 및 로그인 처리
		return this.handleGoogleMobileLogin(
			tokenData.id_token,
			undefined,
			metadata,
		);
	}

	/**
	 * Google 웹 OAuth 콜백 처리 + 교환 코드 생성
	 *
	 * 구글에서 리다이렉트된 authorization code를 처리하고,
	 * JWT 토큰을 DB에 임시 저장한 후 일회용 교환 코드를 반환합니다.
	 * 딥링크 URL에 토큰이 노출되지 않도록 보안을 강화합니다.
	 *
	 * @param code - Google에서 받은 authorization code
	 * @param state - CSRF 방지용 상태 값
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 교환 코드 및 사용자 정보
	 */
	async handleGoogleWebCallbackWithExchangeCode(
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
		// state로 기존 OAuthState 조회 (generateGoogleAuthUrlWithState에서 생성됨)
		const existingState = await this._oauthStateRepository.findByState(state);

		// 기존 로직으로 토큰 생성
		const loginResult = await this.handleGoogleWebCallback(code, metadata);

		let oauthState: Awaited<
			ReturnType<typeof this._oauthStateRepository.create>
		>;
		let redirectUri: string;

		if (existingState) {
			// 기존 state가 있으면 사용
			oauthState = existingState;
			redirectUri = existingState.redirectUri || this.DEFAULT_REDIRECT_URI;
		} else {
			// 레거시 호환: state가 없으면 새로 생성 (직접 callback URL 호출 시)
			this._logger.warn(
				`OAuthState not found for state: ${state}, creating new one`,
			);
			oauthState = await this._oauthStateRepository.create(
				state,
				"GOOGLE",
				this.DEFAULT_REDIRECT_URI,
			);
			redirectUri = this.DEFAULT_REDIRECT_URI;
		}

		// 교환 코드 생성 및 토큰 저장
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

	// ========================================
	// Naver 웹 OAuth
	// ========================================

	/**
	 * Naver 웹 OAuth 인증 URL 생성
	 *
	 * state를 저장하고 Naver OAuth 인증 페이지로 리다이렉트할 URL을 생성합니다.
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @param clientRedirectUri - 클라이언트 리다이렉트 URI (딥링크)
	 * @returns Naver OAuth 인증 URL
	 */
	async generateNaverAuthUrlWithState(
		state: string,
		clientRedirectUri?: string,
	): Promise<string> {
		const { clientId, callbackUrl, isConfigured } =
			this._configService.naverOAuth;

		if (!isConfigured || !clientId || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Redirect URI 검증 (화이트리스트)
		const validatedRedirectUri = this.validateRedirectUri(clientRedirectUri);

		// OAuthState 생성 (redirect_uri 저장)
		await this._oauthStateRepository.create(
			state,
			"NAVER",
			validatedRedirectUri,
		);

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl, // 네이버에는 백엔드 콜백 URL 전달
			response_type: "code",
			state,
		});

		return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
	}

	/**
	 * Naver 웹 OAuth 콜백 처리 (Authorization Code → Access Token 교환)
	 *
	 * 네이버에서 리다이렉트된 authorization code를 access token으로 교환하고,
	 * 사용자 정보를 검증한 후 세션을 생성합니다.
	 *
	 * @param code - Naver에서 받은 authorization code
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 로그인 결과 (토큰, 사용자 정보)
	 */
	async handleNaverWebCallback(
		code: string,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		const { clientId, clientSecret, callbackUrl, isConfigured } =
			this._configService.naverOAuth;

		if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		// Authorization Code → Access Token 교환
		const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: callbackUrl,
				code,
			}).toString(),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			this._logger.error(`Naver token exchange failed: ${errorData}`);
			throw BusinessExceptions.invalidCredentials();
		}

		const tokenData = (await tokenResponse.json()) as {
			access_token: string;
			token_type: string;
			refresh_token?: string;
			expires_in: number;
		};

		// Access Token으로 사용자 정보 검증 및 로그인 처리
		return this.handleNaverMobileLogin(
			tokenData.access_token,
			undefined,
			metadata,
		);
	}

	/**
	 * Naver 웹 OAuth 콜백 처리 + 교환 코드 생성
	 *
	 * 네이버에서 리다이렉트된 authorization code를 처리하고,
	 * JWT 토큰을 DB에 임시 저장한 후 일회용 교환 코드를 반환합니다.
	 * 딥링크 URL에 토큰이 노출되지 않도록 보안을 강화합니다.
	 *
	 * @param code - Naver에서 받은 authorization code
	 * @param state - CSRF 방지용 상태 값
	 * @param metadata - 요청 메타데이터 (IP, User-Agent 등)
	 * @returns 교환 코드 및 사용자 정보
	 */
	async handleNaverWebCallbackWithExchangeCode(
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
		// state로 기존 OAuthState 조회 (generateNaverAuthUrlWithState에서 생성됨)
		const existingState = await this._oauthStateRepository.findByState(state);

		// 기존 로직으로 토큰 생성
		const loginResult = await this.handleNaverWebCallback(code, metadata);

		let oauthState: Awaited<
			ReturnType<typeof this._oauthStateRepository.create>
		>;
		let redirectUri: string;

		if (existingState) {
			// 기존 state가 있으면 사용
			oauthState = existingState;
			redirectUri = existingState.redirectUri || this.DEFAULT_REDIRECT_URI;
		} else {
			// 레거시 호환: state가 없으면 새로 생성 (직접 callback URL 호출 시)
			this._logger.warn(
				`OAuthState not found for state: ${state}, creating new one`,
			);
			oauthState = await this._oauthStateRepository.create(
				state,
				"NAVER",
				this.DEFAULT_REDIRECT_URI,
			);
			redirectUri = this.DEFAULT_REDIRECT_URI;
		}

		// 교환 코드 생성 및 토큰 저장
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
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
			// 서버에서 토큰 검증
			const verifiedProfile =
				await this._tokenVerifier.verifyAppleToken(idToken);

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
		} catch (error) {
			// 토큰 검증 실패 시 LoginAttempt 기록
			await this._loginAttemptRepository.create({
				email: "apple_unknown@social.aido.app",
				provider: "APPLE",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
			});
			throw error;
		}
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
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
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
		} catch (error) {
			// 토큰 검증 실패 시 LoginAttempt 기록
			await this._loginAttemptRepository.create({
				email: "google_unknown@social.aido.app",
				provider: "GOOGLE",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
			});
			throw error;
		}
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
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
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
		} catch (error) {
			// 토큰 검증 실패 시 LoginAttempt 기록
			await this._loginAttemptRepository.create({
				email: "kakao_unknown@social.aido.app",
				provider: "KAKAO",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
			});
			throw error;
		}
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
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		try {
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
		} catch (error) {
			// 토큰 검증 실패 시 LoginAttempt 기록
			await this._loginAttemptRepository.create({
				email: "naver_unknown@social.aido.app",
				provider: "NAVER",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
			});
			throw error;
		}
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
	/**
	 * 소셜 로그인으로 신규 사용자 생성
	 *
	 * 사용자 상태 결정 로직:
	 * - emailVerified=true: ACTIVE 상태 (Apple, Google)
	 * - emailVerified=false: PENDING_VERIFY 상태 (Kakao, Naver 일부)
	 *
	 * PENDING_VERIFY 상태의 소셜 사용자:
	 * - 로그인 및 앱 사용은 가능 (_validateUserStatus에서 허용)
	 * - 비밀번호 찾기 등 이메일 기반 기능은 제한
	 * - 나중에 이메일 인증으로 ACTIVE 상태 전환 가능
	 *
	 * @param data 소셜 프로필 정보
	 * @returns 생성된 사용자
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
			const expiresAt = addMilliseconds(expiresInSeconds * 1000);

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
	/**
	 * 소셜 로그인 사용자 상태 검증
	 *
	 * PENDING_VERIFY 허용 이유:
	 * - 소셜 로그인은 OAuth Provider가 사용자 신원을 이미 검증함
	 * - Kakao/Naver의 경우 이메일이 미인증 상태일 수 있으나,
	 *   소셜 계정 자체의 유효성은 Provider가 보장
	 * - 이메일 인증은 비밀번호 찾기 등 이메일 기반 기능에만 필요
	 *
	 * Provider별 이메일 인증 상태:
	 * - Apple: emailVerified=true 보장 → ACTIVE 상태로 생성
	 * - Google: emailVerified=true 보장 → ACTIVE 상태로 생성
	 * - Kakao: emailVerified 불확실 → PENDING_VERIFY 가능 (로그인 허용)
	 * - Naver: emailVerified 불확실 → PENDING_VERIFY 가능 (로그인 허용)
	 *
	 * @see https://developers.kakao.com/docs/latest/ko/kakaologin/common
	 * @see https://developers.naver.com/docs/login/api/api.md
	 */
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

	/**
	 * 신뢰된 이메일 Provider 여부 확인
	 *
	 * Google, Apple은 항상 이메일이 검증된 상태로 제공되므로 신뢰할 수 있습니다.
	 * Kakao, Naver는 이메일 검증이 선택적이므로 신뢰하지 않습니다.
	 */
	private _isTrustedProvider(provider: AccountProvider): boolean {
		return TRUSTED_EMAIL_PROVIDERS.includes(provider);
	}

	/**
	 * 이메일 충돌 처리 (기존 사용자 + 새 소셜 계정)
	 *
	 * Provider별로 다른 연동 정책을 적용합니다:
	 * - Google/Apple (신뢰된 Provider): 이메일 검증이 보장되므로 자동 연동
	 * - Kakao/Naver: 이메일 검증이 선택적이므로 강제 연동 (에러 반환)
	 *
	 * @param existingUser - 동일 이메일의 기존 사용자
	 * @param provider - OAuth Provider
	 * @param providerAccountId - Provider에서 제공한 계정 ID
	 * @param options - 추가 옵션 (이메일 검증 여부, IP 등)
	 * @returns 자동 연동 성공 시 LoginResult
	 * @throws socialAccountNotLinked - 강제 연동 필요 시
	 */
	private async _handleEmailConflict(
		existingUser: { id: string; email: string; status: string },
		provider: AccountProvider,
		providerAccountId: string,
		options: {
			emailVerified?: boolean;
			appleRefreshToken?: string;
			ip: string;
			userAgent: string;
		},
	): Promise<LoginResult> {
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

	// ============================================
	// OAuth Exchange Code (일회용 교환 코드) 관련
	// ============================================

	/**
	 * 교환 코드 생성 및 저장
	 *
	 * OAuth 인증 성공 후 JWT 토큰을 DB에 임시 저장하고,
	 * 일회용 교환 코드를 생성하여 반환합니다.
	 * 딥링크 URL에는 이 교환 코드만 전달되어 토큰 노출을 방지합니다.
	 *
	 * @param oauthStateId - OAuthState 레코드 ID
	 * @param tokens - JWT 토큰 쌍 (accessToken, refreshToken)
	 * @param userInfo - 사용자 정보 (userId, userName, profileImage)
	 * @returns 생성된 교환 코드 (base64url 인코딩)
	 */
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

	/**
	 * 교환 코드로 토큰 교환
	 *
	 * 일회용 교환 코드를 검증하고, 저장된 JWT 토큰과 사용자 정보를 반환합니다.
	 * 교환 완료 후 토큰은 DB에서 삭제되어 재사용이 불가능합니다.
	 *
	 * @param code - OAuth 인증 후 발급된 일회용 교환 코드
	 * @returns 저장된 토큰 및 사용자 정보
	 * @throws InvalidCredentials - 유효하지 않거나 만료/사용된 교환 코드
	 */
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
			accessToken: oauthState.accessToken,
			refreshToken: oauthState.refreshToken,
			userId: oauthState.userId,
			userName: oauthState.userName ?? undefined,
			profileImage: oauthState.profileImage ?? undefined,
		};
	}
}

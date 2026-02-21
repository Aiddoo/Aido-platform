import type { AccountProvider } from "@/generated/prisma/client";
import type { OAuthMode } from "../../repositories/oauth-state.repository";

import type { VerifiedProfile } from "../oauth-token-verifier.service";

/**
 * OAuth Provider별 차이점만 캡슐화하는 Strategy 인터페이스
 *
 * OAuthService는 공통 흐름(로그인, URL 생성, 콜백 처리)을 관리하고,
 * 각 전략 클래스가 provider-specific 로직을 담당합니다.
 */
export interface IOAuthProviderStrategy {
	/** Provider 식별자 */
	readonly provider: AccountProvider;

	/** 토큰 검증 실패 시 LoginAttempt에 기록할 이메일 */
	readonly failureEmail: string;

	/**
	 * OAuth 인증 URL 생성 (Web flow)
	 *
	 * Apple은 web flow가 없으므로 null을 반환합니다.
	 * @param params.state CSRF 방지용 state 값
	 * @param params.validatedRedirectUri 검증된 redirect URI
	 * @param params.persistState state를 DB에 저장하는 콜백
	 */
	generateAuthUrl(params: GenerateAuthUrlParams): Promise<string | null>;

	/**
	 * Authorization Code → Token 교환
	 *
	 * Apple은 web flow가 없으므로 null을 반환합니다.
	 * @returns token: verifyToken에 전달할 토큰 (idToken 또는 accessToken)
	 */
	exchangeCode(code: string, state?: string): Promise<ExchangedToken | null>;

	/**
	 * 모바일 클라이언트 토큰 검증
	 *
	 * OAuthTokenVerifierService에 위임합니다.
	 */
	verifyToken(token: string, nonce?: string): Promise<VerifiedProfile>;

	/**
	 * VerifiedProfile에서 _handleSocialLogin 옵션을 빌드
	 *
	 * Apple: userName 파라미터만 사용, profileImage 없음
	 * Google/Kakao/Naver: userName ?? profile.name, profileImage = profile.picture
	 */
	buildLoginOptions(
		verifiedProfile: VerifiedProfile,
		userName?: string,
	): SocialLoginOptions;
}

export interface GenerateAuthUrlParams {
	state: string;
	validatedRedirectUri: string;
	mode?: OAuthMode;
	initiatingUserId?: string;
	persistState: (
		provider: AccountProvider,
		redirectUri: string,
		opts: { mode?: OAuthMode; initiatingUserId?: string },
	) => Promise<unknown>;
}

export interface ExchangedToken {
	token: string;
}

export interface SocialLoginOptions {
	userName?: string;
	emailVerified: boolean;
	profileImage?: string;
}

import type { AccountProvider } from "@/auth/domain/types";

/**
 * OAuth 신원 제공자 통합 포트.
 *
 * 소셜 로그인 4종(구글·카카오·네이버·애플)의 provider별 차이(인증 URL 생성,
 * 코드 교환, 토큰 검증, 로그인 옵션 빌드)를 단일 인터페이스로 추상화한다.
 * 각 벤더 어댑터(infrastructure/oauth/adapters)가 이 포트를 구현하고,
 * `OAUTH_IDENTITY_PROVIDER_REGISTRY`(provider→어댑터 Map)로 조회된다.
 *
 * OAuthService는 공통 흐름(로그인, URL 생성, 콜백 처리)만 관리하고,
 * provider-specific 로직은 각 어댑터가 담당한다. (Payment 프로바이더 레지스트리 패턴)
 */
export const OAUTH_IDENTITY_PROVIDER_REGISTRY = Symbol(
	"OAUTH_IDENTITY_PROVIDER_REGISTRY",
);

/** OAuth 흐름 모드: 신규 로그인 vs 기존 계정 링크 */
export type OAuthMode = "login" | "link";

/** 벤더 토큰 검증 결과(정규화된 프로필) */
export interface VerifiedProfile {
	id: string;
	email?: string | null;
	emailVerified: boolean;
	name?: string;
	picture?: string;
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

export interface OAuthIdentityProvider {
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

/** provider → 어댑터 레지스트리(불변) */
export type OAuthIdentityProviderRegistry = ReadonlyMap<
	AccountProvider,
	OAuthIdentityProvider
>;

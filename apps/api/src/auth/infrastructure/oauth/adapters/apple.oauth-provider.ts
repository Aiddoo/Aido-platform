import type {
	OAuthIdentityProvider,
	SocialLoginOptions,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type {
	OAuthTokenVerifierService,
	VerifiedProfile,
} from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";

/**
 * Apple OAuth 전략
 *
 * - Web flow 없음 (모바일 Sign In with Apple SDK만 사용)
 * - idToken + optional nonce로 검증
 * - Apple은 첫 로그인 시에만 이름을 제공하므로 userName 파라미터만 사용
 * - profileImage 미제공
 */
export class AppleOAuthProvider implements OAuthIdentityProvider {
	readonly provider = "APPLE" as const;
	readonly failureEmail = "apple_unknown@social.aido.kr";

	readonly #verifier: OAuthTokenVerifierService;

	constructor(verifier: OAuthTokenVerifierService) {
		this.#verifier = verifier;
	}

	async generateAuthUrl(): Promise<null> {
		return null;
	}

	async exchangeCode(): Promise<null> {
		return null;
	}

	async verifyToken(idToken: string, nonce?: string): Promise<VerifiedProfile> {
		return this.#verifier.verifyAppleToken(idToken, nonce);
	}

	buildLoginOptions(
		verifiedProfile: VerifiedProfile,
		userName?: string,
	): SocialLoginOptions {
		return {
			userName,
			emailVerified: verifiedProfile.emailVerified,
		};
	}
}

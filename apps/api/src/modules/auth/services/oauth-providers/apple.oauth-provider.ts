import type {
	OAuthTokenVerifierService,
	VerifiedProfile,
} from "../oauth-token-verifier.service";
import type {
	IOAuthProviderStrategy,
	SocialLoginOptions,
} from "./oauth-provider.strategy";

/**
 * Apple OAuth 전략
 *
 * - Web flow 없음 (모바일 Sign In with Apple SDK만 사용)
 * - idToken + optional nonce로 검증
 * - Apple은 첫 로그인 시에만 이름을 제공하므로 userName 파라미터만 사용
 * - profileImage 미제공
 */
export class AppleOAuthProvider implements IOAuthProviderStrategy {
	readonly provider = "APPLE" as const;
	readonly failureEmail = "apple_unknown@social.aido.app";

	constructor(private readonly _verifier: OAuthTokenVerifierService) {}

	async generateAuthUrl(): Promise<null> {
		return null;
	}

	async exchangeCode(): Promise<null> {
		return null;
	}

	async verifyToken(idToken: string, nonce?: string): Promise<VerifiedProfile> {
		return this._verifier.verifyAppleToken(idToken, nonce);
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

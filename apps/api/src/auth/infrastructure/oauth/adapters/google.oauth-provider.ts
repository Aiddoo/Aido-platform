import { ErrorCode } from "@aido/errors";
import type { Logger } from "@nestjs/common";
import type {
	ExchangedToken,
	GenerateAuthUrlParams,
	OAuthIdentityProvider,
	SocialLoginOptions,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type {
	OAuthTokenVerifierService,
	VerifiedProfile,
} from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { readJson } from "@/shared/infrastructure/http/read-json";

interface OAuthConfig {
	clientId: string | undefined;
	clientSecret: string | undefined;
	callbackUrl: string | undefined;
	isConfigured: boolean;
}

/**
 * Google OAuth 전략
 *
 * - idToken 기반 검증
 * - scope: openid email profile + access_type=offline, prompt=consent
 * - 토큰 교환 시 id_token 필드 사용
 */
export class GoogleOAuthProvider implements OAuthIdentityProvider {
	readonly provider = "GOOGLE" as const;
	readonly failureEmail = "google_unknown@social.aido.kr";

	readonly #getConfig: () => OAuthConfig;
	readonly #verifier: OAuthTokenVerifierService;
	readonly #logger: Logger;

	constructor(
		getConfig: () => OAuthConfig,
		verifier: OAuthTokenVerifierService,
		logger: Logger,
	) {
		this.#getConfig = getConfig;
		this.#verifier = verifier;
		this.#logger = logger;
	}

	async generateAuthUrl(params: GenerateAuthUrlParams): Promise<string> {
		const { clientId, callbackUrl, isConfigured } = this.#getConfig();

		if (!isConfigured || !clientId || !callbackUrl) {
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		await params.persistState("GOOGLE", params.validatedRedirectUri, {
			mode: params.mode,
			initiatingUserId:
				params.mode === "link" ? params.initiatingUserId : undefined,
		});

		const urlParams = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl,
			response_type: "code",
			state: params.state,
			scope: "openid email profile",
			access_type: "offline",
			prompt: "consent",
		});

		return `https://accounts.google.com/o/oauth2/v2/auth?${urlParams.toString()}`;
	}

	async exchangeCode(code: string): Promise<ExchangedToken> {
		const { clientId, clientSecret, callbackUrl, isConfigured } =
			this.#getConfig();

		if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
			this.#logger.error(`Google token exchange failed: ${errorData}`);
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		const tokenData = await readJson<{
			access_token: string;
			id_token: string;
			token_type: string;
			refresh_token?: string;
			expires_in: number;
		}>(tokenResponse);

		return { token: tokenData.id_token };
	}

	async verifyToken(idToken: string): Promise<VerifiedProfile> {
		return this.#verifier.verifyGoogleToken(idToken);
	}

	buildLoginOptions(
		verifiedProfile: VerifiedProfile,
		userName?: string,
	): SocialLoginOptions {
		return {
			userName: userName ?? verifiedProfile.name,
			emailVerified: verifiedProfile.emailVerified,
			profileImage: verifiedProfile.picture,
		};
	}
}

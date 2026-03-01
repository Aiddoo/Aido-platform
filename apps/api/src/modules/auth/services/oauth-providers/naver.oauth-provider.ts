import type { Logger } from "@nestjs/common";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import type {
	OAuthTokenVerifierService,
	VerifiedProfile,
} from "../oauth-token-verifier.service";
import type {
	ExchangedToken,
	GenerateAuthUrlParams,
	IOAuthProviderStrategy,
	SocialLoginOptions,
} from "./oauth-provider.strategy";

interface OAuthConfig {
	clientId: string | undefined;
	clientSecret: string | undefined;
	callbackUrl: string | undefined;
	isConfigured: boolean;
}

/**
 * Naver OAuth 전략
 *
 * - accessToken 기반 검증
 * - scope 파라미터 없음
 * - exchangeCode에 optional state 전달 (Naver API 요구사항)
 */
export class NaverOAuthProvider implements IOAuthProviderStrategy {
	readonly provider = "NAVER" as const;
	readonly failureEmail = "naver_unknown@social.aido.kr";

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
			throw BusinessExceptions.invalidCredentials();
		}

		await params.persistState("NAVER", params.validatedRedirectUri, {
			mode: params.mode,
			initiatingUserId:
				params.mode === "link" ? params.initiatingUserId : undefined,
		});

		const urlParams = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl,
			response_type: "code",
			state: params.state,
		});

		return `https://nid.naver.com/oauth2.0/authorize?${urlParams.toString()}`;
	}

	async exchangeCode(code: string, state?: string): Promise<ExchangedToken> {
		const { clientId, clientSecret, callbackUrl, isConfigured } =
			this.#getConfig();

		if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
			throw BusinessExceptions.invalidCredentials();
		}

		const tokenRequestBody = new URLSearchParams({
			grant_type: "authorization_code",
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: callbackUrl,
			code,
		});

		if (state) {
			tokenRequestBody.set("state", state);
		}

		const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: tokenRequestBody.toString(),
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			this.#logger.error(`Naver token exchange failed: ${errorData}`);
			throw BusinessExceptions.invalidCredentials();
		}

		const tokenData = (await tokenResponse.json()) as {
			access_token: string;
			token_type: string;
			refresh_token?: string;
			expires_in: number;
		};

		return { token: tokenData.access_token };
	}

	async verifyToken(accessToken: string): Promise<VerifiedProfile> {
		return this.#verifier.verifyNaverToken(accessToken);
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

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
 * Naver OAuth 전략
 *
 * - accessToken 기반 검증
 * - scope 파라미터 없음
 * - exchangeCode에 optional state 전달 (Naver API 요구사항)
 */
export class NaverOAuthProvider implements OAuthIdentityProvider {
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
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0602);
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
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		const tokenData = await readJson<{
			access_token: string;
			token_type: string;
			refresh_token?: string;
			expires_in: number;
		}>(tokenResponse);

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

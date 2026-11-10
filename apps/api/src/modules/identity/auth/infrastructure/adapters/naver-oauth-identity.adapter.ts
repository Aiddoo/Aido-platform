import { ErrorCode } from "@aido/api/errors";
import type { Logger } from "@nestjs/common";
import type { HttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import type {
  ExchangedToken,
  GenerateAuthUrlParams,
  OAuthIdentityProvider,
  OAuthTokenVerifier,
  SocialLoginOptions,
  VerifiedProfile,
} from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { readJson } from "#api/platform/http/read-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ApplicationException } from "#api/shared/application/application.exception";

import { NAVER_OAUTH_POLICY } from "./oauth-outbound.policy.js";
import { readOAuthProviderError } from "./oauth-provider-error.wire.js";

const NAVER_TOKEN_RESPONSE_SCHEMA = z.object({ access_token: z.string() });

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
export class NaverOAuthIdentityAdapter implements OAuthIdentityProvider {
  readonly provider = "NAVER" as const;
  readonly failureEmail = "naver_unknown@social.aido.kr";

  readonly #getConfig: () => OAuthConfig;
  readonly #verifier: OAuthTokenVerifier;
  readonly #logger: Logger;
  readonly #policy: OutboundPolicy;
  readonly #http: HttpClient;

  constructor(
    getConfig: () => OAuthConfig,
    verifier: OAuthTokenVerifier,
    logger: Logger,
    http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    this.#http = http;
    this.#policy = policies.get(NAVER_OAUTH_POLICY);
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
      initiatingUserId: params.mode === "link" ? params.initiatingUserId : undefined,
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
    const { clientId, clientSecret, callbackUrl, isConfigured } = this.#getConfig();

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

    const { data: tokenResponse } = await this.#policy.execute((signal) =>
      this.#http.request("https://nid.naver.com/oauth2.0/token", {
        method: "POST",
        responseType: "response",
        retry: false,
        throwOnHttpError: false,
        signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenRequestBody.toString(),
      }),
    );

    if (!tokenResponse.ok) {
      this.#logger.error({
        event: AuthLogEvent.OAUTH_TOKEN_EXCHANGE_FAILED,
        provider: this.provider,
        statusCode: tokenResponse.status,
        providerError: await readOAuthProviderError(tokenResponse),
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const tokenData = await readJson(tokenResponse, NAVER_TOKEN_RESPONSE_SCHEMA);
    if (!tokenData.success) {
      this.#logger.error({
        event: AuthLogEvent.OAUTH_TOKEN_EXCHANGE_INVALID,
        provider: this.provider,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    return { token: tokenData.data.access_token };
  }

  async verifyToken(accessToken: string): Promise<VerifiedProfile> {
    return this.#verifier.verifyNaverToken(accessToken);
  }

  buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return {
      userName: userName ?? verifiedProfile.name,
      emailVerified: verifiedProfile.emailVerified,
      profileImage: verifiedProfile.picture,
    };
  }
}

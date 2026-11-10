import { ErrorCode } from "@aido/api/errors";
import type { Logger } from "@nestjs/common";
import type { HttpClient } from "@nestjs/http-client";
import { z } from "zod";

import type {
  ExchangedToken,
  GenerateAuthUrlParams,
  OAuthIdentityProvider,
  OAuthTokenVerifier,
  SocialLoginOptions,
  VerifiedProfile,
} from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { AuthInfraLogEvent } from "#api/modules/identity/auth/infrastructure/auth-infra.log-events";
import { readJson } from "#api/platform/http/read-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ApplicationException } from "#api/shared/application/application.exception";

import { GOOGLE_OAUTH_POLICY } from "./oauth-outbound.policy.js";
import { readOAuthProviderError } from "./oauth-provider-error.wire.js";

const GOOGLE_TOKEN_RESPONSE_SCHEMA = z.object({ id_token: z.string() });

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
export class GoogleOAuthIdentityAdapter implements OAuthIdentityProvider {
  readonly provider = "GOOGLE" as const;
  readonly failureEmail = "google_unknown@social.aido.kr";

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
    this.#policy = policies.get(GOOGLE_OAUTH_POLICY);
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
      initiatingUserId: params.mode === "link" ? params.initiatingUserId : undefined,
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
    const { clientId, clientSecret, callbackUrl, isConfigured } = this.#getConfig();

    if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const { data: tokenResponse } = await this.#policy.execute((signal) =>
      this.#http.request("https://oauth2.googleapis.com/token", {
        method: "POST",
        responseType: "response",
        retry: false,
        throwOnHttpError: false,
        signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          code,
        }).toString(),
      }),
    );

    if (!tokenResponse.ok) {
      this.#logger.error({
        event: AuthInfraLogEvent.OAUTH_TOKEN_EXCHANGE_FAILED,
        provider: this.provider,
        statusCode: tokenResponse.status,
        providerError: await readOAuthProviderError(tokenResponse),
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const tokenData = await readJson(tokenResponse, GOOGLE_TOKEN_RESPONSE_SCHEMA);
    if (!tokenData.success) {
      this.#logger.error({
        event: AuthInfraLogEvent.OAUTH_TOKEN_EXCHANGE_INVALID,
        provider: this.provider,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    return { token: tokenData.data.id_token };
  }

  async verifyToken(idToken: string): Promise<VerifiedProfile> {
    return this.#verifier.verifyGoogleToken(idToken);
  }

  buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return {
      userName: userName ?? verifiedProfile.name,
      emailVerified: verifiedProfile.emailVerified,
      profileImage: verifiedProfile.picture,
    };
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { OAuth2Client } from "google-auth-library";

import { readJson } from "#api/platform/http/read-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import {
  expiredSocialToken,
  invalidCredentials,
  invalidSocialToken,
} from "../../application/auth.errors.js";
import { AuthLogEvent } from "../../application/auth.log-events.js";
import {
  type ExchangedToken,
  type GenerateAuthUrlParams,
  OAuthIdentityProviderPort,
  type SocialLoginOptions,
  type VerifiedProfile,
} from "../../application/ports/oauth-identity-provider.port.js";
import { identityAuthConfig } from "../../identity-auth.config.js";
import { googleIdTokenPayloadSchema, googleTokenResponseSchema } from "./google.wire.js";
import { GOOGLE_OAUTH_POLICY, OAUTH_PROVIDER_TIMEOUT_MS } from "./oauth-outbound.policy.js";
import { logOAuthTokenVerifyFailed, readOAuthProviderError } from "./oauth-provider-error.wire.js";

/** Google 로그인. 웹 흐름은 code를 id_token으로 바꾸고, 앱·웹 모두 id_token을 서버에서 검증한다. */
@Injectable()
export class GoogleOAuthIdentityAdapter extends OAuthIdentityProviderPort {
  readonly provider = "GOOGLE" as const;
  readonly failureEmail = "google_unknown@social.aido.kr";

  readonly #logger = new Logger(GoogleOAuthIdentityAdapter.name);
  readonly #config: ConfigType<typeof identityAuthConfig>["google"];
  readonly #http: HttpClient;
  readonly #policy: OutboundPolicy;
  readonly #client: OAuth2Client;

  constructor(
    @Inject(identityAuthConfig.KEY) config: ConfigType<typeof identityAuthConfig>,
    @InjectHttpClient("oauth") http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    super();
    this.#config = config.google;
    this.#http = http;
    this.#policy = policies.get(GOOGLE_OAUTH_POLICY);
    this.#client = new OAuth2Client({
      clientId: config.google.clientId,
      // Google 공개키(cert) 조회도 같은 시간 제한을 쓴다
      transporterOptions: { timeout: OAUTH_PROVIDER_TIMEOUT_MS },
    });
  }

  async generateAuthUrl(params: GenerateAuthUrlParams): Promise<string> {
    const { clientId, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !callbackUrl) {
      throw invalidCredentials();
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
    const { clientId, clientSecret, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
      throw invalidCredentials();
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
        event: AuthLogEvent.OAUTH_TOKEN_EXCHANGE_FAILED,
        provider: this.provider,
        statusCode: tokenResponse.status,
        providerError: await readOAuthProviderError(tokenResponse),
      });
      throw invalidCredentials();
    }

    const tokenData = await readJson(tokenResponse, googleTokenResponseSchema);
    if (!tokenData.success) {
      this.#logger.error({
        event: AuthLogEvent.OAUTH_TOKEN_EXCHANGE_INVALID,
        provider: this.provider,
      });
      throw invalidCredentials();
    }
    return { token: tokenData.data.id_token };
  }

  async verifyToken(idToken: string): Promise<VerifiedProfile> {
    try {
      const ticket = await this.#client.verifyIdToken({
        idToken,
        audience: this.#config.clientId,
      });
      const payload = googleIdTokenPayloadSchema.optional().parse(ticket.getPayload());
      if (payload == null) {
        throw invalidSocialToken("GOOGLE");
      }
      return {
        id: payload.sub ?? "",
        email: payload.email ?? null,
        emailVerified: payload.email_verified ?? false,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      // google-auth-library는 만료 전용 오류 타입이 없고 서명 검증 경로의 문구가 "Token used too late"다
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isExpired =
        errorMessage.includes("expired") || errorMessage.includes("token used too late");
      logOAuthTokenVerifyFailed(this.#logger, "GOOGLE", error, isExpired ? "expired" : "invalid");
      if (isExpired) {
        throw expiredSocialToken("GOOGLE");
      }
      throw invalidSocialToken("GOOGLE");
    }
  }

  buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return {
      userName: userName ?? verifiedProfile.name,
      emailVerified: verifiedProfile.emailVerified,
      profileImage: verifiedProfile.picture,
    };
  }
}

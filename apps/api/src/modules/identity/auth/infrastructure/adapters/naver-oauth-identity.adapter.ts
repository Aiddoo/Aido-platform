import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { readJson } from "#api/platform/http/read-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ApplicationException } from "#api/shared/application/application.exception";

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
import { naverTokenResponseSchema, naverUserInfoSchema } from "./naver.wire.js";
import { NAVER_OAUTH_POLICY } from "./oauth-outbound.policy.js";
import { logOAuthTokenVerifyFailed, readOAuthProviderError } from "./oauth-provider-error.wire.js";

const NAVER_USER_INFO_URL = "https://openapi.naver.com/v1/nid/me";

/** 네이버 로그인. code를 access_token으로 바꾸고 프로필 API로 토큰을 검증한다. */
@Injectable()
export class NaverOAuthIdentityAdapter extends OAuthIdentityProviderPort {
  readonly provider = "NAVER" as const;
  readonly failureEmail = "naver_unknown@social.aido.kr";

  readonly #logger = new Logger(NaverOAuthIdentityAdapter.name);
  readonly #config: ConfigType<typeof identityAuthConfig>["naver"];
  readonly #http: HttpClient;
  readonly #policy: OutboundPolicy;

  constructor(
    @Inject(identityAuthConfig.KEY) config: ConfigType<typeof identityAuthConfig>,
    @InjectHttpClient("oauth") http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    super();
    this.#config = config.naver;
    this.#http = http;
    this.#policy = policies.get(NAVER_OAUTH_POLICY);
  }

  async generateAuthUrl(params: GenerateAuthUrlParams): Promise<string> {
    const { clientId, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !callbackUrl) {
      throw invalidCredentials();
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
    const { clientId, clientSecret, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
      throw invalidCredentials();
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
      throw invalidCredentials();
    }

    const tokenData = await readJson(tokenResponse, naverTokenResponseSchema);
    if (!tokenData.success) {
      this.#logger.error({
        event: AuthLogEvent.OAUTH_TOKEN_EXCHANGE_INVALID,
        provider: this.provider,
      });
      throw invalidCredentials();
    }
    return { token: tokenData.data.access_token };
  }

  async verifyToken(accessToken: string): Promise<VerifiedProfile> {
    try {
      const { data: response } = await this.#policy.execute((signal) =>
        this.#http.request(NAVER_USER_INFO_URL, {
          responseType: "response",
          retry: false,
          throwOnHttpError: false,
          signal,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      if (!response.ok) {
        throw response.status === 401 ? expiredSocialToken("NAVER") : invalidSocialToken("NAVER");
      }

      const parsed = await readJson(response, naverUserInfoSchema);
      if (!parsed.success || parsed.data.resultcode !== "00" || !parsed.data.response) {
        throw invalidSocialToken("NAVER");
      }
      const naverUser = parsed.data.response;
      // 네이버는 이메일 인증 여부를 주지 않아 자동 연동하지 않고 수동 연동으로 보낸다
      return {
        id: naverUser.id,
        email: naverUser.email ?? null,
        emailVerified: false,
        name: naverUser.name || (naverUser.nickname ?? undefined),
        picture: naverUser.profile_image ?? undefined,
      };
    } catch (error) {
      logOAuthTokenVerifyFailed(this.#logger, "NAVER", error);
      if (error instanceof ApplicationException) {
        throw error;
      }
      throw invalidSocialToken("NAVER");
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

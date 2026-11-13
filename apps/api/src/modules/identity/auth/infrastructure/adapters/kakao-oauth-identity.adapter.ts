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
import { kakaoTokenResponseSchema, kakaoUserInfoSchema } from "./kakao.wire.js";
import { KAKAO_OAUTH_POLICY } from "./oauth-outbound.policy.js";
import { logOAuthTokenVerifyFailed, readOAuthProviderError } from "./oauth-provider-error.wire.js";

const KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me?secure_resource=true";

/** 카카오 로그인. code를 access_token으로 바꾸고 사용자 정보 API로 토큰을 검증한다. */
@Injectable()
export class KakaoOAuthIdentityAdapter extends OAuthIdentityProviderPort {
  readonly provider = "KAKAO" as const;
  readonly failureEmail = "kakao_unknown@social.aido.kr";

  readonly #logger = new Logger(KakaoOAuthIdentityAdapter.name);
  readonly #config: ConfigType<typeof identityAuthConfig>["kakao"];
  readonly #http: HttpClient;
  readonly #policy: OutboundPolicy;

  constructor(
    @Inject(identityAuthConfig.KEY) config: ConfigType<typeof identityAuthConfig>,
    @InjectHttpClient("oauth") http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    super();
    this.#config = config.kakao;
    this.#http = http;
    this.#policy = policies.get(KAKAO_OAUTH_POLICY);
  }

  async generateAuthUrl(params: GenerateAuthUrlParams): Promise<string> {
    const { clientId, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !callbackUrl) {
      throw invalidCredentials();
    }

    await params.persistState("KAKAO", params.validatedRedirectUri, {
      mode: params.mode,
      initiatingUserId: params.mode === "link" ? params.initiatingUserId : undefined,
    });

    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      state: params.state,
      scope: "profile_nickname profile_image",
    });
    return `https://kauth.kakao.com/oauth/authorize?${urlParams.toString()}`;
  }

  async exchangeCode(code: string): Promise<ExchangedToken> {
    const { clientId, clientSecret, callbackUrl, isConfigured } = this.#config;
    if (!isConfigured || !clientId || !clientSecret || !callbackUrl) {
      throw invalidCredentials();
    }

    const { data: tokenResponse } = await this.#policy.execute((signal) =>
      this.#http.request("https://kauth.kakao.com/oauth/token", {
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

    const tokenData = await readJson(tokenResponse, kakaoTokenResponseSchema);
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
        this.#http.request(KAKAO_USER_INFO_URL, {
          responseType: "response",
          retry: false,
          throwOnHttpError: false,
          signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
        }),
      );

      if (!response.ok) {
        throw response.status === 401 ? expiredSocialToken("KAKAO") : invalidSocialToken("KAKAO");
      }

      const parsed = await readJson(response, kakaoUserInfoSchema);
      if (!parsed.success) {
        throw invalidSocialToken("KAKAO");
      }
      const kakaoAccount = parsed.data.kakao_account;
      return {
        id: String(parsed.data.id),
        email: kakaoAccount?.email ?? null,
        emailVerified: kakaoAccount?.is_email_verified ?? false,
        name: kakaoAccount?.profile?.nickname ?? undefined,
        picture: kakaoAccount?.profile?.profile_image_url ?? undefined,
      };
    } catch (error) {
      logOAuthTokenVerifyFailed(this.#logger, "KAKAO", error);
      if (error instanceof ApplicationException) {
        throw error;
      }
      throw invalidSocialToken("KAKAO");
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

import { Logger } from "@nestjs/common";
import type { HttpClient } from "@nestjs/http-client";

import type {
  OAuthIdentityProvider,
  OAuthIdentityProviderRegistry,
  OAuthTokenVerifier,
} from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/auth/domain/identity.constants";
import type { TypedConfigService } from "#api/platform/config/services/config.service";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { AppleOAuthIdentityAdapter } from "./apple-oauth-identity.adapter.js";
import { GoogleOAuthIdentityAdapter } from "./google-oauth-identity.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./naver-oauth-identity.adapter.js";

export function createOAuthProviderRegistry(
  configService: TypedConfigService,
  tokenVerifier: OAuthTokenVerifier,
  http: HttpClient,
  policies: OutboundPolicyRegistry,
): OAuthIdentityProviderRegistry {
  const logger = new Logger("OAuthIdentityProvider");
  return new Map<AccountProvider, OAuthIdentityProvider>([
    ["APPLE", new AppleOAuthIdentityAdapter(tokenVerifier)],
    [
      "GOOGLE",
      new GoogleOAuthIdentityAdapter(
        () => configService.googleOAuth,
        tokenVerifier,
        logger,
        http,
        policies,
      ),
    ],
    [
      "KAKAO",
      new KakaoOAuthIdentityAdapter(
        () => configService.kakaoOAuth,
        tokenVerifier,
        logger,
        http,
        policies,
      ),
    ],
    [
      "NAVER",
      new NaverOAuthIdentityAdapter(
        () => configService.naverOAuth,
        tokenVerifier,
        logger,
        http,
        policies,
      ),
    ],
  ]);
}

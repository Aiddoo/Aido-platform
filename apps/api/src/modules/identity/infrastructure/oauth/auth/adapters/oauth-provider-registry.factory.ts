import { Logger } from "@nestjs/common";
import type { HttpClient } from "@nestjs/http-client";

import type {
  OAuthIdentityProvider,
  OAuthIdentityProviderRegistry,
  OAuthTokenVerifier,
} from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import type { TypedConfigService } from "#api/platform/config/services/config.service";

import { AppleOAuthProvider } from "./apple.oauth-provider.js";
import { GoogleOAuthProvider } from "./google.oauth-provider.js";
import { KakaoOAuthProvider } from "./kakao.oauth-provider.js";
import { NaverOAuthProvider } from "./naver.oauth-provider.js";

export function createOAuthProviderRegistry(
  configService: TypedConfigService,
  tokenVerifier: OAuthTokenVerifier,
  http: HttpClient,
): OAuthIdentityProviderRegistry {
  const logger = new Logger("OAuthIdentityProvider");
  return new Map<AccountProvider, OAuthIdentityProvider>([
    ["APPLE", new AppleOAuthProvider(tokenVerifier)],
    [
      "GOOGLE",
      new GoogleOAuthProvider(() => configService.googleOAuth, tokenVerifier, logger, http),
    ],
    ["KAKAO", new KakaoOAuthProvider(() => configService.kakaoOAuth, tokenVerifier, logger, http)],
    ["NAVER", new NaverOAuthProvider(() => configService.naverOAuth, tokenVerifier, logger, http)],
  ]);
}

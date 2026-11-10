import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createRemoteJWKSet, errors, jwtVerify, type RemoteJWKSet } from "jose";

import { ApplicationException } from "#api/shared/application/application.exception";

import { AuthLogEvent } from "../../application/auth.log-events.js";
import {
  OAuthIdentityProviderPort,
  type SocialLoginOptions,
  type VerifiedProfile,
} from "../../application/ports/oauth-identity-provider.port.js";
import { identityAuthConfig } from "../../identity-auth.config.js";
import { APPLE_ISSUER, APPLE_JWKS_URL, appleIdTokenClaimsSchema } from "./apple.wire.js";
import { logOAuthTokenVerifyFailed } from "./oauth-provider-error.wire.js";

/**
 * Sign in with Apple. 웹 인가 흐름 없이 모바일 SDK가 준 idToken(+nonce)만 검증한다.
 * Apple은 첫 로그인에만 이름을 주므로 요청의 userName만 쓰고 프로필 이미지는 없다.
 */
@Injectable()
export class AppleOAuthIdentityAdapter extends OAuthIdentityProviderPort {
  readonly provider = "APPLE" as const;
  readonly failureEmail = "apple_unknown@social.aido.kr";

  readonly #logger = new Logger(AppleOAuthIdentityAdapter.name);
  readonly #config: ConfigType<typeof identityAuthConfig>["apple"];
  #jwks: RemoteJWKSet | null = null;

  constructor(@Inject(identityAuthConfig.KEY) config: ConfigType<typeof identityAuthConfig>) {
    super();
    this.#config = config.apple;
  }

  async generateAuthUrl(): Promise<null> {
    return null;
  }

  async exchangeCode(): Promise<null> {
    return null;
  }

  async verifyToken(idToken: string, expectedNonce?: string): Promise<VerifiedProfile> {
    try {
      const { payload } = await jwtVerify(idToken, this.#keySet(), {
        issuer: APPLE_ISSUER,
        audience: this.#config.clientId,
      });
      const claims = appleIdTokenClaimsSchema.parse(payload);

      if (expectedNonce) {
        const hashedNonce = createHash("sha256").update(expectedNonce).digest("hex");
        if (claims.nonce !== hashedNonce) {
          this.#logger.warn({ event: AuthLogEvent.OAUTH_NONCE_REJECTED, provider: "APPLE" });
          throw new ApplicationException(ErrorCode.SOCIAL_0202, { provider: "APPLE" });
        }
      }

      return {
        id: claims.sub,
        email: claims.email ?? null,
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
      };
    } catch (error) {
      logOAuthTokenVerifyFailed(this.#logger, "APPLE", error);
      if (error instanceof errors.JWTExpired) {
        throw new ApplicationException(ErrorCode.SOCIAL_0203, { provider: "APPLE" });
      }
      throw new ApplicationException(ErrorCode.SOCIAL_0202, { provider: "APPLE" });
    }
  }

  buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return { userName, emailVerified: verifiedProfile.emailVerified };
  }

  // 공개키 묶음은 처음 검증할 때 한 번 만들고 jose가 키 교체·cooldown을 관리한다
  #keySet(): RemoteJWKSet {
    if (this.#jwks == null) {
      const cooldownDuration = this.#config.jwksCooldownDurationMs;
      this.#jwks = createRemoteJWKSet(
        new URL(this.#config.jwksUrl ?? APPLE_JWKS_URL),
        cooldownDuration == null ? undefined : { cooldownDuration },
      );
    }
    return this.#jwks;
  }
}

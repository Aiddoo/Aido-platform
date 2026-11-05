import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, errors, jwtVerify, type RemoteJWKSet } from "jose";
import { match } from "ts-pattern";
import { z } from "zod";

import type { VerifiedProfile } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { IdentityInfraLogEvent } from "#api/modules/identity/infrastructure/observability/auth/identity-infra-log.events";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { KAKAO_OAUTH_POLICY, NAVER_OAUTH_POLICY } from "../oauth-outbound.policies.js";

export type { VerifiedProfile };

const KAKAO_USER_INFO_SCHEMA = z.object({
  id: z.number(),
  kakao_account: z
    .object({
      email: z.string().nullish(),
      is_email_verified: z.boolean().nullish(),
      profile: z
        .object({
          nickname: z.string().nullish(),
          profile_image_url: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

const NAVER_USER_INFO_SCHEMA = z.object({
  resultcode: z.string(),
  response: z
    .object({
      id: z.string(),
      email: z.string().nullish(),
      name: z.string().nullish(),
      nickname: z.string().nullish(),
      profile_image: z.string().nullish(),
    })
    .nullish(),
});

interface AppleIdTokenClaims {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
  auth_time: number;
  nonce_supported: boolean;
  nonce?: string;
}

/** 공급자가 응답하지 않아도 로그인 요청을 오래 붙잡지 않도록 OAuth 공급자 호출마다 거는 시간 제한 */
export const OAUTH_PROVIDER_TIMEOUT_MS = 10_000;

// 모바일 클라이언트 토큰을 서버에서 직접 검증 (각 OAuth Provider의 공식 API/JWKS 사용)
@Injectable()
export class OAuthTokenVerifierService {
  readonly #logger = new Logger(OAuthTokenVerifierService.name);
  readonly #googleClient: OAuth2Client;
  readonly #kakaoPolicy: OutboundPolicy;
  readonly #naverPolicy: OutboundPolicy;
  #appleJWKS: RemoteJWKSet | null = null;

  private static readonly APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
  private static readonly APPLE_ISSUER = "https://appleid.apple.com";

  private static readonly KAKAO_USER_INFO_URL =
    "https://kapi.kakao.com/v2/user/me?secure_resource=true";

  private static readonly NAVER_USER_INFO_URL = "https://openapi.naver.com/v1/nid/me";

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("oauth") private readonly http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    this.#kakaoPolicy = policies.get(KAKAO_OAUTH_POLICY);
    this.#naverPolicy = policies.get(NAVER_OAUTH_POLICY);
    this.#googleClient = new OAuth2Client({
      clientId: this.configService.googleOAuth.clientId,
      // Google 공개키(cert) 조회도 같은 시간 제한을 쓴다
      transporterOptions: { timeout: OAUTH_PROVIDER_TIMEOUT_MS },
    });
  }

  /**
   * Provider별 토큰 검증 통합 dispatch 메서드
   *
   * Apple/Google은 idToken, Kakao/Naver는 accessToken을 사용합니다.
   */
  async verifyToken(
    provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
    token: string,
    nonce?: string,
  ): Promise<VerifiedProfile> {
    return match(provider)
      .with("APPLE", () => this.verifyAppleToken(token, nonce))
      .with("GOOGLE", () => this.verifyGoogleToken(token))
      .with("KAKAO", () => this.verifyKakaoToken(token))
      .with("NAVER", () => this.verifyNaverToken(token))
      .exhaustive();
  }

  // @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
  async verifyAppleToken(idToken: string, expectedNonce?: string): Promise<VerifiedProfile> {
    try {
      if (this.#appleJWKS == null) {
        const jwksUrl =
          this.configService.appleOAuth.jwksUrl ?? OAuthTokenVerifierService.APPLE_JWKS_URL;
        const cooldownDuration = this.configService.appleOAuth.jwksCooldownDurationMs;
        this.#appleJWKS = createRemoteJWKSet(
          new URL(jwksUrl),
          cooldownDuration == null ? undefined : { cooldownDuration },
        );
      }

      const appleClientId = this.configService.appleOAuth.clientId;

      const { payload } = await jwtVerify<AppleIdTokenClaims>(idToken, this.#appleJWKS, {
        issuer: OAuthTokenVerifierService.APPLE_ISSUER,
        audience: appleClientId,
      });

      if (expectedNonce) {
        const hashedNonce = createHash("sha256").update(expectedNonce).digest("hex");
        if (payload.nonce !== hashedNonce) {
          this.#logger.warn({
            event: IdentityInfraLogEvent.OAUTH_NONCE_REJECTED,
            provider: "APPLE",
          });
          throw new ApplicationException(ErrorCode.SOCIAL_0202, {
            provider: "APPLE",
          });
        }
      }

      const emailVerified = payload.email_verified === true || payload.email_verified === "true";

      return {
        id: payload.sub,
        email: payload.email ?? null,
        emailVerified,
      };
    } catch (error) {
      this.#logVerifyFailed("APPLE", error);

      if (error instanceof errors.JWTExpired) {
        throw new ApplicationException(ErrorCode.SOCIAL_0203, {
          provider: "APPLE",
        });
      }
      if (error instanceof errors.JWTClaimValidationFailed) {
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "APPLE",
        });
      }

      throw new ApplicationException(ErrorCode.SOCIAL_0202, {
        provider: "APPLE",
      });
    }
  }

  // @see https://developers.google.com/identity/sign-in/web/backend-auth
  async verifyGoogleToken(idToken: string): Promise<VerifiedProfile> {
    try {
      const googleClientId = this.configService.googleOAuth.clientId;

      const ticket = await this.#googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "GOOGLE",
        });
      }

      return {
        id: payload.sub ?? "",
        email: payload.email ?? null,
        emailVerified: payload.email_verified ?? false,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isExpired =
        errorMessage.includes("expired") || errorMessage.includes("token used too late");

      // Google v11 오류 문자열에는 decoded payload가 포함될 수 있어 원문을 로그하지 않는다.
      this.#logVerifyFailed("GOOGLE", error, isExpired ? "expired" : "invalid");

      // Google Auth Library는 전용 만료 오류 타입 없이 일반 Error를 사용한다.
      // 실제 서명 검증 경로의 메시지는 "Token used too late"이므로 기존 expired 표현과 함께 처리한다.
      if (isExpired) {
        throw new ApplicationException(ErrorCode.SOCIAL_0203, {
          provider: "GOOGLE",
        });
      }

      throw new ApplicationException(ErrorCode.SOCIAL_0202, {
        provider: "GOOGLE",
      });
    }
  }

  // @see https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
  async verifyKakaoToken(accessToken: string): Promise<VerifiedProfile> {
    try {
      const { data: response } = await this.#kakaoPolicy.execute((signal) =>
        this.http.request(OAuthTokenVerifierService.KAKAO_USER_INFO_URL, {
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
        if (response.status === 401) {
          throw new ApplicationException(ErrorCode.SOCIAL_0203, {
            provider: "KAKAO",
          });
        }
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "KAKAO",
        });
      }

      const parsed = await readJson(response, KAKAO_USER_INFO_SCHEMA);
      if (!parsed.success) {
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "KAKAO",
        });
      }

      const data = parsed.data;
      const kakaoAccount = data.kakao_account;

      return {
        id: String(data.id),
        email: kakaoAccount?.email ?? null,
        emailVerified: kakaoAccount?.is_email_verified ?? false,
        name: kakaoAccount?.profile?.nickname ?? undefined,
        picture: kakaoAccount?.profile?.profile_image_url ?? undefined,
      };
    } catch (error) {
      this.#logVerifyFailed("KAKAO", error);

      if (error instanceof Error && error.name === "ApplicationException") {
        throw error;
      }

      throw new ApplicationException(ErrorCode.SOCIAL_0202, {
        provider: "KAKAO",
      });
    }
  }

  // @see https://developers.naver.com/docs/login/profile/profile.md
  async verifyNaverToken(accessToken: string): Promise<VerifiedProfile> {
    try {
      const { data: response } = await this.#naverPolicy.execute((signal) =>
        this.http.request(OAuthTokenVerifierService.NAVER_USER_INFO_URL, {
          responseType: "response",
          retry: false,
          throwOnHttpError: false,
          signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new ApplicationException(ErrorCode.SOCIAL_0203, {
            provider: "NAVER",
          });
        }
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "NAVER",
        });
      }

      const parsed = await readJson(response, NAVER_USER_INFO_SCHEMA);
      if (!parsed.success) {
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "NAVER",
        });
      }

      const data = parsed.data;
      if (data.resultcode !== "00" || !data.response) {
        throw new ApplicationException(ErrorCode.SOCIAL_0202, {
          provider: "NAVER",
        });
      }

      const naverUser = data.response;

      // Naver는 이메일 인증 여부를 제공하지 않으므로 false 설정
      // 자동 계정 연동 불가 — 수동 연동 필요 (handleEmailConflict에서 처리)
      return {
        id: naverUser.id,
        email: naverUser.email ?? null,
        emailVerified: false,
        name: naverUser.name || (naverUser.nickname ?? undefined),
        picture: naverUser.profile_image ?? undefined,
      };
    } catch (error) {
      this.#logVerifyFailed("NAVER", error);

      if (error instanceof Error && error.name === "ApplicationException") {
        throw error;
      }

      throw new ApplicationException(ErrorCode.SOCIAL_0202, {
        provider: "NAVER",
      });
    }
  }

  #logVerifyFailed(
    provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
    error: unknown,
    reason?: "expired" | "invalid",
  ): void {
    this.#logger.error({
      event: IdentityInfraLogEvent.OAUTH_TOKEN_VERIFY_FAILED,
      provider,
      ...(reason != null && { reason }),
      errorType: toErrorType(error),
      ...(error instanceof ErrorCodedException && { errorCode: error.errorCode }),
    });
  }
}

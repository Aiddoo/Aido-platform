import type { currentUserSchema, LinkedAccountsResponse } from "@aido/api/contracts/auth";
import type { z } from "zod";

import type {
  ExchangeCodeResult,
  LoginResult,
  RefreshTokensResult,
  RegisterResult,
  SocialLoginResult,
  UpdateProfileResult,
  VerifyEmailResult,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
/**
 * Auth 모듈 매퍼
 *
 * 인증 관련 서비스 결과를 API 응답 형식으로 변환하는 Static 메서드를 제공합니다.
 * 회원가입, 로그인, 토큰 갱신, 프로필 관리 등의 응답 변환을 담당합니다.
 *
 * @module auth.mapper
 */
import type { ListLinkedAccountsResult } from "#api/modules/identity/auth/application/use-cases/list-linked-accounts.use-case";
import type { CurrentUserResult } from "#api/modules/identity/users/application/read-models/current-user.read-model";
import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

/**
 * Auth 도메인의 Mapper 클래스
 *
 * 인증 관련 서비스 결과를 API 응답 형식으로 변환합니다.
 */
export const AuthMapper = {
  /**
   * 회원가입 결과를 API 응답 형식으로 변환합니다.
   *
   * @param result - 회원가입 처리 결과
   * @returns 회원가입 응답 객체
   *
   * @example
   * ```typescript
   * const result = await authService.register(dto);
   * return AuthMapper.toRegisterResponse(result);
   * // { message: "...", email: "user@example.com" }
   * ```
   */
  toRegisterResponse(result: RegisterResult) {
    return {
      message: result.message,
      email: result.email,
      emailSent: result.emailSent,
    };
  },

  /**
   * 이메일 인증 결과를 API 응답 형식으로 변환합니다.
   *
   * @param result - 이메일 인증 처리 결과
   * @returns 인증 토큰 응답 객체
   *
   * @example
   * ```typescript
   * const result = await authService.verifyEmail(dto, metadata);
   * return AuthMapper.toAuthTokensResponse(result);
   * ```
   */
  toAuthTokensResponse(result: VerifyEmailResult | LoginResult, appVersion?: string) {
    return {
      userId: result.userId,
      userTag: result.userTag,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      name: result.name,
      profileImage: resolveProfileImage(result.profileImage, appVersion),
      accountRestored: result.accountRestored ?? false,
    };
  },

  /** 소셜 로그인 결과를 응답으로 바꾼다. 신규 가입이면 `isNewUser: true`를 싣는다. */
  toSocialAuthTokensResponse(result: SocialLoginResult, appVersion?: string) {
    return {
      ...AuthMapper.toAuthTokensResponse(result, appVersion),
      isNewUser: result.isNewUser,
    };
  },

  toRefreshTokensResponse(result: RefreshTokensResult) {
    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  },

  /**
   * 현재 사용자 정보를 API 응답 형식으로 변환합니다.
   *
   * @param result - 현재 사용자 정보 조회 결과
   * @returns 현재 사용자 응답 객체
   *
   * @example
   * ```typescript
   * const result = await authService.getCurrentUser(userId, sessionId);
   * return AuthMapper.toCurrentUserResponse(result);
   * ```
   */
  toCurrentUserResponse(
    result: CurrentUserResult,
    appVersion?: string,
  ): z.input<typeof currentUserSchema> {
    return {
      userId: result.userId,
      email: result.email,
      sessionId: result.sessionId,
      role: result.role,
      userTag: result.userTag,
      status: result.status,
      emailVerifiedAt: result.emailVerifiedAt,
      subscriptionStatus: result.subscriptionStatus,
      subscriptionExpiresAt: result.subscriptionExpiresAt,
      name: result.name,
      profileImage: resolveProfileImage(result.profileImage, appVersion),
      createdAt: result.createdAt,
      providers: result.providers,
      premiumSource: result.premiumSource,
      premiumEndsAt: result.premiumEndsAt,
      premiumPeriodEndsAt: result.premiumPeriodEndsAt,
      willRenew: result.willRenew,
      bankedPremiumDays: result.bankedPremiumDays,
      premiumGrantEndedAt: result.premiumGrantEndedAt,
      premiumIsTrial: result.premiumIsTrial,
      premiumPlanType: result.premiumPlanType,
      isPremium: result.isPremium,
      entitlements: result.entitlements,
    };
  },

  /**
   * 프로필 수정 결과를 API 응답 형식으로 변환합니다.
   *
   * @param result - 프로필 수정 처리 결과
   * @returns 프로필 수정 응답 객체
   *
   * @example
   * ```typescript
   * const result = await authService.updateProfile(userId, dto);
   * return AuthMapper.toUpdateProfileResponse(result);
   * ```
   */
  toUpdateProfileResponse(result: UpdateProfileResult, appVersion?: string) {
    return {
      message: result.message,
      name: result.name,
      profileImage: resolveProfileImage(result.profileImage, appVersion),
    };
  },

  /**
   * 단순 메시지 응답을 생성합니다.
   *
   * @param message - 응답 메시지
   * @returns 메시지 응답 객체
   *
   * @example
   * ```typescript
   * return AuthMapper.toMessageResponse("로그아웃되었습니다.");
   * ```
   */
  toMessageResponse(message: string) {
    return { message };
  },

  /**
   * OAuth 코드 교환 결과를 API 응답 형식으로 변환합니다.
   *
   * @param result - OAuth 코드 교환 처리 결과
   * @returns 인증 토큰 응답 객체
   *
   * @example
   * ```typescript
   * const result = await oauthService.exchangeCodeForTokens(code);
   * return AuthMapper.toExchangeCodeResponse(result);
   * ```
   */
  toExchangeCodeResponse(result: ExchangeCodeResult, appVersion?: string) {
    return {
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      name: result.userName ?? null,
      profileImage: resolveProfileImage(result.profileImage ?? null, appVersion),
      accountRestored: result.accountRestored ?? false,
      isNewUser: result.isNewUser,
    };
  },
};

export function toLinkedAccountsResponse(result: ListLinkedAccountsResult): LinkedAccountsResponse {
  return {
    accounts: result.accounts.map((account) => ({
      ...account,
      linkedAt: account.linkedAt == null ? null : toIsoString(account.linkedAt),
    })),
    canUnlink: result.canUnlink,
  };
}

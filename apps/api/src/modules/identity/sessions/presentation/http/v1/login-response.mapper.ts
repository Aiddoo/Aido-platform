import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type {
  LoginResult,
  RefreshTokensResult,
  SocialLoginResult,
  VerifyEmailResult,
} from "../../../application/read-models/login.read-model.js";

export function toAuthTokensResponse(result: VerifyEmailResult | LoginResult, appVersion?: string) {
  return {
    userId: result.userId,
    userTag: result.userTag,
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    name: result.name,
    profileImage: resolveProfileImage(result.profileImage, appVersion),
    accountRestored: result.accountRestored ?? false,
  };
}

/** 신규 가입이면 `isNewUser: true`를 싣는다 */
export function toSocialAuthTokensResponse(result: SocialLoginResult, appVersion?: string) {
  return {
    ...toAuthTokensResponse(result, appVersion),
    isNewUser: result.isNewUser,
  };
}

export function toRefreshTokensResponse(result: RefreshTokensResult) {
  return {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
  };
}

export function toMessageResponse(message: string) {
  return { message };
}

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type { ExchangeCodeResult } from "../../../application/read-models/oauth-exchange.read-model.js";

export function toExchangeCodeResponse(result: ExchangeCodeResult, appVersion?: string) {
  return {
    userId: result.userId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    name: result.userName ?? null,
    profileImage: resolveProfileImage(result.profileImage ?? null, appVersion),
    accountRestored: result.accountRestored ?? false,
    isNewUser: result.isNewUser,
  };
}

import type { oAuthState as oAuthStateTable } from "#api/platform/database/schema/index";

import { OAuthState } from "../../domain/oauth-state.aggregate.js";

type OAuthStateRow = typeof oAuthStateTable.$inferSelect;

export function toOAuthState(row: OAuthStateRow): OAuthState {
  return OAuthState.reconstitute({
    id: row.id,
    state: row.state,
    provider: row.provider,
    redirectUri: row.redirectUri,
    mode: row.mode,
    initiatingUserId: row.initiatingUserId,
    exchangeCode: row.exchangeCode,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    userId: row.userId,
    userName: row.userName,
    profileImage: row.profileImage,
    accountRestored: row.accountRestored,
    isNewUser: row.isNewUser,
    expiresAt: row.expiresAt,
    exchangedAt: row.exchangedAt,
  });
}

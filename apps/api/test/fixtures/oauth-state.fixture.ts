import type { AuthOAuthStateRecord } from "#api/modules/identity/application/ports/auth/auth-persistence.port";

export const OAuthStateFixture = {
  create(overrides: Partial<AuthOAuthStateRecord> = {}): AuthOAuthStateRecord {
    return {
      id: 1,
      state: "oauth-state",
      provider: "GOOGLE",
      redirectUri: "aido://auth/callback",
      mode: "login",
      initiatingUserId: null,
      exchangeCode: null,
      accessToken: null,
      refreshToken: null,
      userId: null,
      userName: null,
      profileImage: null,
      accountRestored: null,
      expiresAt: new Date(Date.now() + 600_000),
      exchangedAt: null,
      ...overrides,
    };
  },
};

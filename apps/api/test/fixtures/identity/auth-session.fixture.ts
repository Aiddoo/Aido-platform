import {
  AuthSession,
  type AuthSessionPrimitives,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import {
  IdentityUser,
  type IdentityUserPrimitives,
} from "#api/modules/identity/users/domain/identity-user.aggregate";

export const AUTH_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const AUTH_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const AUTH_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";
export const AUTH_FIXTURE_SESSION_ID = "clz7x5p8k0003qz0z8z8z8z8z";

export function createAuthSessionFixture(
  overrides: Partial<AuthSessionPrimitives> = {},
): AuthSession {
  return AuthSession.reconstitute({
    id: AUTH_FIXTURE_SESSION_ID,
    userId: AUTH_FIXTURE_USER_ID,
    refreshTokenHash: "current-hash",
    previousTokenHash: null,
    tokenFamily: "token-family",
    tokenVersion: 1,
    deviceFingerprint: "Aido/1.15.0",
    ipAddress: "127.0.0.1",
    userAgent: "Aido/1.15.0",
    lastUsedAt: AUTH_FIXTURE_NOW,
    createdAt: AUTH_FIXTURE_NOW,
    updatedAt: AUTH_FIXTURE_NOW,
    expiresAt: AUTH_FIXTURE_NOW.add({ hours: 24 * 7 }),
    revokedAt: null,
    ...overrides,
  });
}

export function createIdentityUserFixture(
  overrides: Partial<IdentityUserPrimitives> = {},
): IdentityUser {
  return IdentityUser.reconstitute({
    id: AUTH_FIXTURE_USER_ID,
    email: "user@example.com",
    userTag: "AIDO2345",
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: AUTH_FIXTURE_NOW,
    subscriptionStatus: "FREE",
    subscriptionExpiresAt: null,
    createdAt: AUTH_FIXTURE_NOW,
    deletedAt: null,
    ...overrides,
  });
}

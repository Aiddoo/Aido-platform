import type { AuthAccountRecord } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import {
  AuthOAuthState,
  type AuthOAuthStatePrimitives,
} from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import {
  AuthVerification,
  type AuthVerificationPrimitives,
} from "#api/modules/identity/auth/domain/auth-verification.aggregate";

import { AUTH_FIXTURE_NOW, AUTH_FIXTURE_USER_ID } from "./auth-session.fixture.js";

export function createAuthVerificationFixture(
  overrides: Partial<AuthVerificationPrimitives> = {},
): AuthVerification {
  return AuthVerification.reconstitute({
    id: 1,
    userId: AUTH_FIXTURE_USER_ID,
    type: "EMAIL_VERIFY",
    tokenHash: "digest:123456",
    expiresAt: AUTH_FIXTURE_NOW.add({ minutes: 10 }),
    attempts: 0,
    usedAt: null,
    createdAt: AUTH_FIXTURE_NOW,
    ...overrides,
  });
}

export function createAuthOAuthStateFixture(
  overrides: Partial<AuthOAuthStatePrimitives> = {},
): AuthOAuthState {
  return AuthOAuthState.reconstitute({
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
    isNewUser: null,
    expiresAt: AUTH_FIXTURE_NOW.add({ minutes: 10 }),
    exchangedAt: null,
    ...overrides,
  });
}

export function createAuthAccountFixture(
  overrides: Partial<AuthAccountRecord> = {},
): AuthAccountRecord {
  return {
    id: 1,
    userId: AUTH_FIXTURE_USER_ID,
    provider: "CREDENTIAL",
    providerAccountId: overrides.userId ?? AUTH_FIXTURE_USER_ID,
    password: "digest:CorrectPassword1!",
    createdAt: AUTH_FIXTURE_NOW,
    ...overrides,
  };
}

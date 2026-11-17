import type { LinkedAccountRecord } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import {
  OAuthState,
  type OAuthStatePrimitives,
} from "#api/modules/identity/oauth-states/domain/oauth-state.aggregate";
import {
  Verification,
  type VerificationPrimitives,
} from "#api/modules/identity/verifications/domain/verification.aggregate";

import { AUTH_FIXTURE_NOW, AUTH_FIXTURE_USER_ID } from "./session.fixture.js";

export function createVerificationFixture(
  overrides: Partial<VerificationPrimitives> = {},
): Verification {
  return Verification.reconstitute({
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

export function createOAuthStateFixture(overrides: Partial<OAuthStatePrimitives> = {}): OAuthState {
  return OAuthState.reconstitute({
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

export function createLinkedAccountFixture(
  overrides: Partial<LinkedAccountRecord> = {},
): LinkedAccountRecord {
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

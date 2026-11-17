import {
  Session,
  type SessionPrimitives,
} from "#api/modules/identity/sessions/domain/session.aggregate";
import { User, type UserPrimitives } from "#api/modules/identity/users/domain/user.aggregate";

export const AUTH_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const AUTH_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const AUTH_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";
export const AUTH_FIXTURE_SESSION_ID = "clz7x5p8k0003qz0z8z8z8z8z";

export function createSessionFixture(overrides: Partial<SessionPrimitives> = {}): Session {
  return Session.reconstitute({
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

export function createUserFixture(overrides: Partial<UserPrimitives> = {}): User {
  return User.reconstitute({
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

import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { Session } from "#test/types/database-rows";

const SESSION_ROW_LIFETIME_HOURS = 7 * 24;

export function createSessionRowFixture(overrides: Partial<Session> = {}): Session {
  const sequence = nextFixtureSequence("session");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? `session-${sequence}`,
    userId: overrides.userId ?? `user-${sequence}`,
    refreshTokenHash: overrides.refreshTokenHash ?? `hash-${sequence}-${now.epochMilliseconds}`,
    tokenFamily: overrides.tokenFamily ?? `family-${sequence}`,
    tokenVersion: overrides.tokenVersion ?? 1,
    previousTokenHash: overrides.previousTokenHash ?? null,
    deviceFingerprint: overrides.deviceFingerprint ?? `fingerprint-${sequence}`,
    userAgent: overrides.userAgent ?? "Mozilla/5.0 (Test)",
    ipAddress: overrides.ipAddress ?? "127.0.0.1",
    expiresAt: overrides.expiresAt ?? now.add({ hours: SESSION_ROW_LIFETIME_HOURS }),
    revokedAt: overrides.revokedAt ?? null,
    revokedReason: overrides.revokedReason ?? null,
    lastUsedAt: overrides.lastUsedAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { Verification } from "#test/types/database-rows";

export function createVerificationRowFixture(overrides: Partial<Verification> = {}): Verification {
  const sequence = nextFixtureSequence("verification");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    userId: overrides.userId ?? `user-${sequence}`,
    type: overrides.type ?? "EMAIL_VERIFY",
    token: overrides.token ?? `token-${sequence}-${now.epochMilliseconds}`,
    expiresAt: overrides.expiresAt ?? now.add({ minutes: 10 }),
    usedAt: overrides.usedAt ?? null,
    attempts: overrides.attempts ?? 0,
    createdAt: overrides.createdAt ?? now,
  };
}

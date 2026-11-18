import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { Account } from "#test/types/database-rows";

export function createLinkedAccountRowFixture(overrides: Partial<Account> = {}): Account {
  const sequence = nextFixtureSequence("linked-account");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    userId: overrides.userId ?? `user-${sequence}`,
    provider: overrides.provider ?? "CREDENTIAL",
    providerAccountId: overrides.providerAccountId ?? `provider-${sequence}`,
    password: overrides.password ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

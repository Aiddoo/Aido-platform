import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { User, UserProfile } from "#test/types/database-rows";

/** nullable override의 null은 보존하며 undefined는 기본값을 쓴다. */
export function createUserRowFixture(overrides: Partial<User> = {}): User {
  const sequence = nextFixtureSequence("user");
  return buildUserRow(sequence, overrides);
}

export function createUserWithProfileRowFixture(
  userOverrides: Partial<User> = {},
  profileOverrides: Partial<UserProfile> = {},
): { user: User; profile: UserProfile } {
  const sequence = nextFixtureSequence("user");
  const user = buildUserRow(sequence, userOverrides);
  const profile: UserProfile = {
    id: profileOverrides.id ?? `profile-${sequence}`,
    userId: user.id,
    name: profileOverrides.name === undefined ? `User ${sequence}` : profileOverrides.name,
    profileImage: profileOverrides.profileImage ?? null,
  };
  return { user, profile };
}

function buildUserRow(sequence: number, overrides: Partial<User>): User {
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? `user-${sequence}`,
    email: overrides.email ?? `test-${sequence}@example.com`,
    userTag: overrides.userTag ?? `USR${String(sequence).padStart(5, "0")}`,
    role: overrides.role ?? "USER",
    status: overrides.status ?? "ACTIVE",
    emailVerifiedAt: overrides.emailVerifiedAt === undefined ? now : overrides.emailVerifiedAt,
    subscriptionStatus: overrides.subscriptionStatus ?? "FREE",
    subscriptionExpiresAt: overrides.subscriptionExpiresAt ?? null,
    storeAppUserId: overrides.storeAppUserId ?? null,
    aiUsageCount: overrides.aiUsageCount ?? 0,
    aiUsageResetAt: overrides.aiUsageResetAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastLoginAt: overrides.lastLoginAt ?? null,
    lastActiveAt: overrides.lastActiveAt ?? null,
    lastSeenAppVersion: overrides.lastSeenAppVersion ?? null,
    lastSeenAppVersionAt: overrides.lastSeenAppVersionAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
  };
}

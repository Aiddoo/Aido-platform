import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { Cheer, Follow, Nudge } from "#test/types/database-rows";

export function createFriendshipRowFixture(overrides: Partial<Follow> = {}): Follow {
  const sequence = nextFixtureSequence("friendship");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? `follow-${sequence}`,
    followerId: overrides.followerId ?? `follower-${sequence}`,
    followingId: overrides.followingId ?? `following-${sequence}`,
    status: overrides.status ?? "PENDING",
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createNudgeRowFixture(overrides: Partial<Nudge> = {}): Nudge {
  const sequence = nextFixtureSequence("nudge");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    senderId: overrides.senderId ?? `sender-${sequence}`,
    receiverId: overrides.receiverId ?? `receiver-${sequence}`,
    todoId: overrides.todoId ?? sequence,
    message: overrides.message ?? null,
    readAt: overrides.readAt ?? null,
    replyKind: overrides.replyKind ?? null,
    repliedAt: overrides.repliedAt ?? null,
    replyUpdatedAt: overrides.replyUpdatedAt ?? null,
    thankedAt: overrides.thankedAt ?? null,
    createdAt: overrides.createdAt ?? now,
  };
}

export function createCheerRowFixture(overrides: Partial<Cheer> = {}): Cheer {
  const sequence = nextFixtureSequence("cheer");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    senderId: overrides.senderId ?? `sender-${sequence}`,
    receiverId: overrides.receiverId ?? `receiver-${sequence}`,
    message: overrides.message ?? null,
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? now,
  };
}

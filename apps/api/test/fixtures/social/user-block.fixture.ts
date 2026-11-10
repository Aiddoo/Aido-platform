import {
  UserBlock,
  type UserBlockPrimitives,
} from "#api/modules/social/blocks/domain/user-block.aggregate";

export const USER_BLOCK_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const USER_BLOCK_FIXTURE_BLOCKER_ID = "clz7x5p8k0101qz0z8z8z8z8z";
export const USER_BLOCK_FIXTURE_BLOCKED_ID = "clz7x5p8k0102qz0z8z8z8z8z";
export const USER_BLOCK_FIXTURE_OTHER_USER_ID = "clz7x5p8k0103qz0z8z8z8z8z";

export function createUserBlockFixture(overrides: Partial<UserBlockPrimitives> = {}): UserBlock {
  return UserBlock.reconstitute({
    id: "cblock0000000000000000001",
    blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
    blockedId: USER_BLOCK_FIXTURE_BLOCKED_ID,
    createdAt: USER_BLOCK_FIXTURE_NOW,
    ...overrides,
  });
}

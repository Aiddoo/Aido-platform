import { Cheer, type CheerPrimitives } from "#api/modules/social/cheers/domain/cheer.aggregate";

// 서울 2026-07-26 09:30
export const CHEER_FIXTURE_NOW = Temporal.Instant.from("2026-07-26T00:30:00Z");
export const CHEER_FIXTURE_SENDER_ID = "clz7x5p8k0101qz0z8z8z8z8z";
export const CHEER_FIXTURE_RECEIVER_ID = "clz7x5p8k0102qz0z8z8z8z8z";
export const CHEER_FIXTURE_OTHER_USER_ID = "clz7x5p8k0103qz0z8z8z8z8z";

export function createCheerFixture(overrides: Partial<CheerPrimitives> = {}): Cheer {
  return Cheer.reconstitute({
    id: 1,
    senderId: CHEER_FIXTURE_SENDER_ID,
    receiverId: CHEER_FIXTURE_RECEIVER_ID,
    message: null,
    readAt: null,
    createdAt: CHEER_FIXTURE_NOW,
    ...overrides,
  });
}

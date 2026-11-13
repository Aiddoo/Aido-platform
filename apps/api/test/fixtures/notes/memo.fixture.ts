import { Memo, type MemoPrimitives } from "#api/modules/notes/memos/domain/memo.aggregate";

export const MEMO_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const MEMO_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const MEMO_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";

export function createMemoFixture(overrides: Partial<MemoPrimitives> = {}): Memo {
  return Memo.reconstitute({
    id: 1,
    userId: MEMO_FIXTURE_USER_ID,
    content: "장보기: 우유, 계란, 빵",
    isPinned: false,
    sortOrder: 0,
    createdAt: MEMO_FIXTURE_NOW,
    updatedAt: MEMO_FIXTURE_NOW,
    idempotencyKey: null,
    requestHash: null,
    ...overrides,
  });
}

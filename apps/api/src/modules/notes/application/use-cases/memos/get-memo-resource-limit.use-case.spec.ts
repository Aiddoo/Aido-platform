import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { GetMemoResourceLimit } from "./get-memo-resource-limit.use-case.js";

describe("GetMemoResourceLimit — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it.each([0, 5])("현재 사용자 메모 %i개와 최대 20개를 반환한다", async (count) => {
    // Given
    for (let index = 0; index < count; index++) fixture.addMemo(`메모 ${index}`);
    fixture.addMemo("다른 사용자", 0, "other-user");
    // When
    const result = await new GetMemoResourceLimit(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({ currentCount: count, maxPerUser: 20 });
  });
});

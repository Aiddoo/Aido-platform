import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { GetMemo } from "./get-memo.use-case.js";

describe("GetMemo — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("소유한 메모의 내용·고정 상태·날짜를 REST 뷰로 반환한다", async () => {
    // Given
    const memo = fixture.addMemo("원문 메모", 3);
    // When
    const result = await new GetMemo(fixture).execute({ userId: fixture.userId, memoId: memo.id });
    // Then
    expect(result.memo).toEqual({
      ...memo,
      createdAt: NOTES_TIME.toISOString(),
      updatedAt: NOTES_TIME.toISOString(),
    });
  });

  it("다른 사용자 메모는 존재하지 않는 메모와 동일하게 MEMO_2001로 거부한다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new GetMemo(fixture).execute({ userId: fixture.userId, memoId: memo.id }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001", details: { memoId: memo.id } });
  });
});

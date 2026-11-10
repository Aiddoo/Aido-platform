import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { DeleteMemo } from "./delete-memo.use-case.js";

describe("DeleteMemo — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("소유한 메모만 삭제하고 같은 ID의 재삭제는 MEMO_2001로 거부한다", async () => {
    // Given
    const memo = fixture.addMemo("삭제할 메모");
    const otherMemo = fixture.addMemo("다른 사용자", 0, "other-user");
    const useCase = new DeleteMemo(fixture);
    // When
    const result = await useCase.execute({ userId: fixture.userId, memoId: memo.id });
    // Then
    expect(result.message).toBe("메모가 삭제되었습니다.");
    expect(fixture.repository.records.has(memo.id)).toBe(false);
    expect(fixture.repository.records.get(otherMemo.id)).toEqual(otherMemo);
    await expect(
      useCase.execute({ userId: fixture.userId, memoId: memo.id }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
  });

  it("소유하지 않은 메모는 MEMO_2001로 거부하고 삭제하지 않는다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new DeleteMemo(fixture).execute({ userId: fixture.userId, memoId: memo.id }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
  });
});

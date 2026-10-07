import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { ToggleMemoPin } from "./toggle-memo-pin.use-case.js";

describe("ToggleMemoPin — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { isPinned: true, message: "메모가 고정되었습니다." },
    { isPinned: false, message: "메모 고정이 해제되었습니다." },
  ])("고정 상태를 $isPinned로 저장하고 내용을 유지한다", async ({ isPinned, message }) => {
    // Given
    const memo = fixture.addMemo("내용 유지", 4);
    fixture.repository.seed({ ...memo, isPinned: !isPinned });
    // When
    const result = await new ToggleMemoPin(fixture).execute({
      userId: fixture.userId,
      memoId: memo.id,
      isPinned,
    });
    // Then
    expect(result.message).toBe(message);
    expect(fixture.repository.records.get(memo.id)).toMatchObject({
      content: "내용 유지",
      sortOrder: 4,
      isPinned,
    });
    expect(result.memo.isPinned).toBe(isPinned);
  });

  it("소유하지 않은 메모는 MEMO_2001로 거부하고 고정 상태를 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new ToggleMemoPin(fixture).execute({
        userId: fixture.userId,
        memoId: memo.id,
        isPinned: true,
      }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.repository.records.get(memo.id)?.isPinned).toBe(false);
  });
});

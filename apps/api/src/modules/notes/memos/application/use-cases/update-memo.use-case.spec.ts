import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { UpdateMemo } from "./update-memo.use-case.js";

describe("UpdateMemo — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("원문 내용을 수정하고 기존 고정·순서·생성 시각은 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("수정 전", 4);
    vi.setSystemTime(new Date(NOTES_TIME.getTime() + 1000));
    // When
    const result = await new UpdateMemo(fixture).execute({
      userId: fixture.userId,
      memoId: memo.id,
      content: "수정 후",
    });
    // Then
    expect(fixture.repository.records.get(memo.id)).toMatchObject({
      content: "수정 후",
      sortOrder: 4,
      isPinned: false,
      createdAt: NOTES_TIME,
      updatedAt: new Date(NOTES_TIME.getTime() + 1000),
    });
    expect(result.memo.content).toBe("수정 후");
  });

  it("소유하지 않은 메모는 잘못된 내용보다 MEMO_2001을 우선한다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new UpdateMemo(fixture).execute({ userId: fixture.userId, memoId: memo.id, content: "" }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.repository.records.get(memo.id)?.content).toBe("다른 사용자");
  });

  it("빈 내용은 SYS_0002로 거부하고 저장된 내용을 변경하지 않는다", async () => {
    // Given
    const memo = fixture.addMemo("유지할 메모");
    // When / Then
    await expect(
      new UpdateMemo(fixture).execute({ userId: fixture.userId, memoId: memo.id, content: "" }),
    ).rejects.toMatchObject({ errorCode: "SYS_0002" });
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
  });
});

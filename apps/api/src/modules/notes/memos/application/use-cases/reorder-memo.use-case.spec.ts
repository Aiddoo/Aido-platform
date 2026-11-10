import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { ReorderMemo } from "./reorder-memo.use-case.js";

describe("ReorderMemo — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("이동할 메모가 없으면 기준 메모 오류보다 MEMO_2001을 우선한다", async () => {
    // Given
    const useCase = new ReorderMemo(fixture);
    // When / Then
    await expect(
      useCase.execute({
        userId: fixture.userId,
        memoId: 100,
        targetMemoId: 101,
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.repository.records.size).toBe(0);
  });

  it("다른 사용자 기준 메모는 MEMO_2002로 거부하고 순서를 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("이동할 메모", 3);
    const target = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new ReorderMemo(fixture).execute({
        userId: fixture.userId,
        memoId: memo.id,
        targetMemoId: target.id,
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2002" });
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
  });

  it("자신을 기준으로 재요청하면 쓰기와 updatedAt 변경 없이 반환한다", async () => {
    // Given
    const memo = fixture.addMemo("메모", 3);
    const update = vi.spyOn(fixture.repository, "updateSortOrder");
    const shift = vi.spyOn(fixture.repository, "shiftSortOrders");
    vi.setSystemTime(new Date(NOTES_TIME.getTime() + 1000));
    // When
    const result = await new ReorderMemo(fixture).execute({
      userId: fixture.userId,
      memoId: memo.id,
      targetMemoId: memo.id,
      position: "before",
    });
    // Then
    expect(result.memo.updatedAt).toBe(NOTES_TIME.toISOString());
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
    expect(update).not.toHaveBeenCalled();
    expect(shift).not.toHaveBeenCalled();
  });

  it("상대 이동은 사용자 내 중간 구간만 이동하고 다른 사용자 순서를 유지한다", async () => {
    // Given
    const first = fixture.addMemo("첫 메모", 0);
    const second = fixture.addMemo("둘째 메모", 1);
    const last = fixture.addMemo("마지막 메모", 2);
    const other = fixture.addMemo("다른 사용자", 1, "other-user");
    // When
    const result = await new ReorderMemo(fixture).execute({
      userId: fixture.userId,
      memoId: last.id,
      targetMemoId: first.id,
      position: "before",
    });
    // Then
    expect(result.memo.sortOrder).toBe(0);
    expect(
      [first, second, last].map((memo) => fixture.repository.records.get(memo.id)?.sortOrder),
    ).toEqual([1, 2, 0]);
    expect(fixture.repository.records.get(other.id)).toEqual(other);
  });

  it("기준 메모를 생략한 맨 뒤 이동은 중간 구간을 당기고 최대 순서로 저장한다", async () => {
    // Given
    const first = fixture.addMemo("첫 메모", 0);
    const second = fixture.addMemo("둘째 메모", 1);
    const last = fixture.addMemo("마지막 메모", 2);
    // When
    await new ReorderMemo(fixture).execute({
      userId: fixture.userId,
      memoId: first.id,
      position: "after",
    });
    // Then
    expect(
      [first, second, last].map((memo) => fixture.repository.records.get(memo.id)?.sortOrder),
    ).toEqual([2, 0, 1]);
  });
});

import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { GetMemos } from "./get-memos.use-case.js";

describe("GetMemos — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("다음 페이지 확인용 초과 항목을 제외하고 마지막 ID를 커서로 반환한다", async () => {
    // Given
    const records = [
      fixture.addMemo("첫 메모", 2),
      fixture.addMemo("둘째 메모", 1),
      fixture.addMemo("다음 페이지", 0),
    ];
    fixture.repository.page = records;
    // When
    const result = await new GetMemos(fixture).execute({ userId: fixture.userId, size: 2 });
    // Then
    expect(result.items.map((memo) => memo.id)).toEqual(records.slice(0, 2).map((memo) => memo.id));
    expect(result.pagination).toEqual({ hasNext: true, nextCursor: records[1]?.id, size: 2 });
  });

  it("고정 메모 우선 반환 순서를 유지하고 마지막 페이지에는 커서가 없다", async () => {
    // Given
    const pinned = { ...fixture.addMemo("고정 메모", 0), isPinned: true };
    const regular = fixture.addMemo("일반 메모", 9);
    fixture.repository.page = [pinned, regular];
    // When
    const result = await new GetMemos(fixture).execute({ userId: fixture.userId, size: 5 });
    // Then
    expect(result.items.map((memo) => memo.id)).toEqual([pinned.id, regular.id]);
    expect(result.items.map((memo) => memo.isPinned)).toEqual([true, false]);
    expect(result.pagination).toEqual({ hasNext: false, nextCursor: null, size: 5 });
  });

  it("다른 사용자 메모만 있으면 빈 페이지를 반환한다", async () => {
    // Given
    fixture.addMemo("다른 사용자", 0, "other-user");
    // When
    const result = await new GetMemos(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result.items).toEqual([]);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it("실제 PaginationService가 정규화한 커서·크기를 저장소로 전달한다", async () => {
    // Given
    const findMany = vi.spyOn(fixture.repository, "findManyByUserId");
    // When
    await new GetMemos(fixture).execute({ userId: fixture.userId, cursor: 10, size: 5 });
    // Then
    expect(findMany).toHaveBeenCalledWith({ userId: fixture.userId, cursor: 10, size: 5 });
  });
});

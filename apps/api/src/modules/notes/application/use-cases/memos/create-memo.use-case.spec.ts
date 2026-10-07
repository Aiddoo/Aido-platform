import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { CreateMemo } from "./create-memo.use-case.js";

describe("CreateMemo — 메모 사용자 상태", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("사용자의 마지막 순서 다음에 원문 메모를 생성하고 다른 사용자 순서는 제외한다", async () => {
    // Given
    fixture.addMemo("기존 메모", 7);
    fixture.addMemo("다른 사용자", 50, "other-user");
    const useCase = new CreateMemo(fixture);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      content: "회의 준비\n\n자료 확인",
    });
    // Then
    expect(result.memo).toMatchObject({
      userId: fixture.userId,
      content: "회의 준비\n\n자료 확인",
      sortOrder: 8,
      isPinned: false,
      createdAt: NOTES_TIME.toISOString(),
    });
    expect(fixture.repository.records.get(result.memo.id)?.content).toBe(result.memo.content);
    expect(await fixture.repository.countByUserId(fixture.userId)).toBe(2);
  });

  it("20개 한도에 도달하면 잘못된 내용보다 MEMO_2003을 우선하고 저장하지 않는다", async () => {
    // Given
    for (let index = 0; index < 20; index++) fixture.addMemo(`메모 ${index}`);
    const recordsBefore = [...fixture.repository.records.values()];
    // When / Then
    await expect(
      new CreateMemo(fixture).execute({ userId: fixture.userId, content: "" }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2003", details: { current: 20, limit: 20 } });
    expect([...fixture.repository.records.values()]).toEqual(recordsBefore);
  });

  it("빈 내용은 SYS_0002로 거부하고 저장 상태를 유지한다", async () => {
    // Given
    const useCase = new CreateMemo(fixture);
    // When / Then
    await expect(useCase.execute({ userId: fixture.userId, content: "" })).rejects.toMatchObject({
      errorCode: "SYS_0002",
    });
    expect(fixture.repository.records.size).toBe(0);
  });
});

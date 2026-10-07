import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock } from "#test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { ToggleMemoPin } from "./toggle-memo-pin.use-case.js";

const memoEntity = (isPinned: boolean): Memo =>
  Memo.reconstitute({
    id: 1,
    userId: "user-1",
    content: "내용",
    isPinned,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("ToggleMemoPin — 메모 고정/해제", () => {
  let useCase: ToggleMemoPin;
  let repository: Mocked<MemoRepositoryPort>;

  beforeEach(async () => {
    const toggleMemoPinDependencies = mockDeep<ConstructorParameters<typeof ToggleMemoPin>[0]>({
      repository: createMemoRepositoryMock(),
    });
    const unit = new ToggleMemoPin(toggleMemoPinDependencies);

    useCase = unit;
    repository = toggleMemoPinDependencies.repository;
  });

  it("메모가 없으면 MEMO_2001을 던지고 고정 상태를 바꾸지 않는다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ userId: "user-1", memoId: 99, isPinned: true }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(repository.updatePinned).not.toHaveBeenCalled();
  });

  it("고정 시 updatePinned(true)를 호출하고 고정 메시지·뷰를 반환한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity(false));
    repository.updatePinned.mockResolvedValue(memoEntity(true));

    // When
    const result = await useCase.execute({
      userId: "user-1",
      memoId: 1,
      isPinned: true,
    });

    // Then
    expect(repository.updatePinned).toHaveBeenCalledWith(1, true);
    expect(result.message).toBe("메모가 고정되었습니다.");
    expect(result.memo.isPinned).toBe(true);
  });

  it("해제 시 updatePinned(false)를 호출하고 해제 메시지·뷰를 반환한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity(true));
    repository.updatePinned.mockResolvedValue(memoEntity(false));

    // When
    const result = await useCase.execute({
      userId: "user-1",
      memoId: 1,
      isPinned: false,
    });

    // Then
    expect(repository.updatePinned).toHaveBeenCalledWith(1, false);
    expect(result.message).toBe("메모 고정이 해제되었습니다.");
    expect(result.memo.isPinned).toBe(false);
  });
});

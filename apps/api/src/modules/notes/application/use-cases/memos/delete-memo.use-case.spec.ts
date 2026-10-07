import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock } from "#test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { DeleteMemo } from "./delete-memo.use-case.js";

const memoEntity = (): Memo =>
  Memo.reconstitute({
    id: 1,
    userId: "user-1",
    content: "내용",
    isPinned: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("DeleteMemo — 메모 삭제", () => {
  let useCase: DeleteMemo;
  let repository: Mocked<MemoRepositoryPort>;

  beforeEach(async () => {
    const deleteMemoDependencies = mockDeep<ConstructorParameters<typeof DeleteMemo>[0]>({
      repository: createMemoRepositoryMock(),
    });
    const unit = new DeleteMemo(deleteMemoDependencies);

    useCase = unit;
    repository = deleteMemoDependencies.repository;
  });

  it("메모가 없으면 MEMO_2001을 던지고 삭제하지 않는다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(useCase.execute({ userId: "user-1", memoId: 99 })).rejects.toMatchObject({
      errorCode: "MEMO_2001",
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("소유한 메모를 삭제하고 성공 메시지를 반환한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());

    // When
    const result = await useCase.execute({ userId: "user-1", memoId: 1 });

    // Then
    expect(repository.findByIdAndUserId).toHaveBeenCalledWith(1, "user-1");
    expect(repository.delete).toHaveBeenCalledWith(1);
    expect(result.message).toBe("메모가 삭제되었습니다.");
  });
});

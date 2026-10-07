import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock } from "#test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { UpdateMemo } from "./update-memo.use-case.js";

const memoEntity = (content: string): Memo =>
  Memo.reconstitute({
    id: 1,
    userId: "user-1",
    content,
    isPinned: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("UpdateMemo — 메모 내용 수정", () => {
  let useCase: UpdateMemo;
  let repository: Mocked<MemoRepositoryPort>;

  beforeEach(async () => {
    const updateMemoDependencies = mockDeep<ConstructorParameters<typeof UpdateMemo>[0]>({
      repository: createMemoRepositoryMock(),
    });
    const unit = new UpdateMemo(updateMemoDependencies);

    useCase = unit;
    repository = updateMemoDependencies.repository;
  });

  it("메모가 없으면 MEMO_2001을 던지고 수정하지 않는다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ userId: "user-1", memoId: 99, content: "새 내용" }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(repository.updateContent).not.toHaveBeenCalled();
  });

  it("소유한 메모 내용을 수정하고 갱신된 뷰를 반환한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity("이전 내용"));
    repository.updateContent.mockResolvedValue(memoEntity("새 내용"));

    // When
    const result = await useCase.execute({
      userId: "user-1",
      memoId: 1,
      content: "새 내용",
    });

    // Then
    expect(repository.updateContent).toHaveBeenCalledWith(1, "새 내용");
    expect(result.message).toBe("메모가 수정되었습니다.");
    expect(result.memo.content).toBe("새 내용");
  });

  it("빈 내용이면 도메인 불변식(SYS_0002)을 던지고 저장하지 않는다", async () => {
    // Given - 소유권은 통과하되 내용 불변식에서 거부
    repository.findByIdAndUserId.mockResolvedValue(memoEntity("이전 내용"));

    // When & Then
    await expect(
      useCase.execute({ userId: "user-1", memoId: 1, content: "" }),
    ).rejects.toMatchObject({ errorCode: "SYS_0002" });
    expect(repository.updateContent).not.toHaveBeenCalled();
  });
});

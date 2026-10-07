import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock } from "#test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { GetMemo } from "./get-memo.use-case.js";

const memoEntity = (): Memo =>
  Memo.reconstitute({
    id: 7,
    userId: "user-1",
    content: "내용",
    isPinned: true,
    sortOrder: 3,
    createdAt: new Date("2026-04-06T00:00:00.000Z"),
    updatedAt: new Date("2026-04-06T00:00:00.000Z"),
  });

describe("GetMemo — 메모 단건 조회", () => {
  let useCase: GetMemo;
  let repository: Mocked<MemoRepositoryPort>;

  beforeEach(async () => {
    const getMemoDependencies = mockDeep<ConstructorParameters<typeof GetMemo>[0]>({
      repository: createMemoRepositoryMock(),
    });
    const unit = new GetMemo(getMemoDependencies);

    useCase = unit;
    repository = getMemoDependencies.repository;
  });

  it("메모가 없으면 MEMO_2001을 던진다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(useCase.execute({ userId: "user-1", memoId: 99 })).rejects.toMatchObject({
      errorCode: "MEMO_2001",
    });
  });

  it("소유한 메모를 소유권 기준으로 조회해 뷰로 반환한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());

    // When
    const result = await useCase.execute({ userId: "user-1", memoId: 7 });

    // Then
    expect(repository.findByIdAndUserId).toHaveBeenCalledWith(7, "user-1");
    expect(result.memo).toEqual(
      expect.objectContaining({
        id: 7,
        userId: "user-1",
        content: "내용",
        isPinned: true,
        sortOrder: 3,
      }),
    );
  });
});

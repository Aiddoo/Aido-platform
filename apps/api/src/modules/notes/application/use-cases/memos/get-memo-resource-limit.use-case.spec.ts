import { MEMO_LIMITS } from "@aido/api/vocabulary";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock } from "#test/mocks/ports/memo.mock";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { GetMemoResourceLimit } from "./get-memo-resource-limit.use-case.js";

describe("GetMemoResourceLimit — 메모 리소스 제한 조회", () => {
  let useCase: GetMemoResourceLimit;
  let repository: Mocked<MemoRepositoryPort>;

  beforeEach(async () => {
    const getMemoResourceLimitDependencies = mockDeep<
      ConstructorParameters<typeof GetMemoResourceLimit>[0]
    >({ repository: createMemoRepositoryMock() });
    const unit = new GetMemoResourceLimit(getMemoResourceLimitDependencies);

    useCase = unit;
    repository = getMemoResourceLimitDependencies.repository;
  });

  it("현재 개수를 저장소에서 세어 한도와 함께 반환한다", async () => {
    // Given
    repository.countByUserId.mockResolvedValue(5);

    // When
    const result = await useCase.execute({ userId: "user-1" });

    // Then
    expect(repository.countByUserId).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({
      currentCount: 5,
      maxPerUser: MEMO_LIMITS.MAX_PER_USER,
    });
  });

  it("메모가 없으면 currentCount 0을 반환한다", async () => {
    // Given
    repository.countByUserId.mockResolvedValue(0);

    // When
    const result = await useCase.execute({ userId: "user-1" });

    // Then
    expect(result.currentCount).toBe(0);
    expect(result.maxPerUser).toBe(MEMO_LIMITS.MAX_PER_USER);
  });
});

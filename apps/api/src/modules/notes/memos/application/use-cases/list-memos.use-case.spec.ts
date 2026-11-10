import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import { createMemoFixture, MEMO_FIXTURE_USER_ID } from "#test/fixtures/notes/memo.fixture";

import { ListMemosUseCase } from "./list-memos.use-case.js";

describe("ListMemosUseCase — 메모 목록", () => {
  it("size보다 많으면 마지막 메모 id를 다음 커서로 주고 그 커서로 나머지를 이어 준다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository(
      [0, 1, 2].map((sortOrder) => createMemoFixture({ id: sortOrder + 1, sortOrder })),
    );
    const useCase = new ListMemosUseCase({ memoRepository });

    // When
    const firstPage = await useCase.execute({ userId: MEMO_FIXTURE_USER_ID, size: 2 });
    const secondPage = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      size: 2,
      cursor: firstPage.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(firstPage.items.map((memo) => memo.id.value)).toEqual([3, 2]);
    expect(firstPage.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(secondPage.items.map((memo) => memo.id.value)).toEqual([1]);
    expect(secondPage.pagination).toEqual({ nextCursor: null, hasNext: false, size: 2 });
  });
});

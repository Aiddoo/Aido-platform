import { ErrorCode } from "@aido/api/errors";

import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import {
  createMemoFixture,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";

import { GetMemoUseCase } from "./get-memo.use-case.js";

describe("GetMemoUseCase — 메모 조회", () => {
  it("남의 메모는 없는 메모와 같게 MEMO_2001로 거절한다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID });
    const useCase = new GetMemoUseCase({ memoRepository: new InMemoryMemoRepository([foreign]) });

    // When
    const result = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, memoId: foreign.id.value });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2001,
      details: { memoId: foreign.id.value },
    });
  });
});

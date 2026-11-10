import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createMemoFixture,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";

import { MemoLockKeys } from "../memos.lock-keys.js";
import { type DeleteMemoDependencies, DeleteMemoUseCase } from "./delete-memo.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);

function createDeleteMemoUseCase(overrides: Partial<DeleteMemoDependencies> = {}) {
  return new DeleteMemoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    memoRepository: new InMemoryMemoRepository(),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("DeleteMemoUseCase — 메모 삭제", () => {
  it("메모·순서 잠금 안에서 지우고 같은 메모를 다시 지우면 MEMO_2001이다", async () => {
    // Given
    const memo = createMemoFixture({ id: 1 });
    const other = createMemoFixture({ id: 2 });
    const memoRepository = new InMemoryMemoRepository([memo, other]);
    const mutationLock = new RecordingMutationLock();
    const useCase = createDeleteMemoUseCase({ memoRepository, mutationLock });

    // When
    await useCase.execute({ userId: MEMO_FIXTURE_USER_ID, memoId: memo.id.value });
    const again = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, memoId: memo.id.value });

    // Then
    await expect(again).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2001 });
    expect(await memoRepository.findByIdAndUserId(memo.id, USER_ID)).toBeNull();
    expect(await memoRepository.findByIdAndUserId(other.id, USER_ID)).not.toBeNull();
    expect(mutationLock.acquiredKeys.at(0)).toEqual([
      MemoLockKeys.memo(memo.id),
      MemoLockKeys.sortOrder(USER_ID),
    ]);
  });

  it("남의 메모는 MEMO_2001로 거절하고 지우지 않는다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID });
    const memoRepository = new InMemoryMemoRepository([foreign]);
    const useCase = createDeleteMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, memoId: foreign.id.value });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2001,
      details: { memoId: foreign.id.value },
    });
    expect(memoRepository.size).toBe(1);
  });
});

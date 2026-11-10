import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createMemoFixture,
  MEMO_FIXTURE_NOW,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";

import {
  type SetMemoPinnedDependencies,
  SetMemoPinnedUseCase,
} from "./set-memo-pinned.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const NOW = MEMO_FIXTURE_NOW.add({ seconds: 1 });

function createSetMemoPinnedUseCase(overrides: Partial<SetMemoPinnedDependencies> = {}) {
  return new SetMemoPinnedUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    memoRepository: new InMemoryMemoRepository(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("SetMemoPinnedUseCase — 메모 고정", () => {
  it.each([true, false])("고정 상태를 %s로 바꾸고 내용·순서는 둔다", async (isPinned) => {
    // Given
    const original = createMemoFixture({ isPinned: !isPinned, sortOrder: 4 });
    const memoRepository = new InMemoryMemoRepository([original]);
    const useCase = createSetMemoPinnedUseCase({ memoRepository });

    // When
    await useCase.execute({ userId: MEMO_FIXTURE_USER_ID, memoId: original.id.value, isPinned });

    // Then
    expect((await memoRepository.findByIdAndUserId(original.id, USER_ID))?.toPrimitives()).toEqual({
      ...original.toPrimitives(),
      isPinned,
      updatedAt: NOW,
    });
  });

  it("이미 같은 상태면 저장하지 않아 수정 시각이 그대로다", async () => {
    // Given
    const original = createMemoFixture({ isPinned: true });
    const memoRepository = new InMemoryMemoRepository([original]);
    const useCase = createSetMemoPinnedUseCase({ memoRepository });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: original.id.value,
      isPinned: true,
    });

    // Then
    expect(memo.toPrimitives()).toEqual(original.toPrimitives());
    expect((await memoRepository.findByIdAndUserId(original.id, USER_ID))?.toPrimitives()).toEqual(
      original.toPrimitives(),
    );
  });

  it("남의 메모는 MEMO_2001로 거절하고 고정 상태를 둔다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID });
    const memoRepository = new InMemoryMemoRepository([foreign]);
    const useCase = createSetMemoPinnedUseCase({ memoRepository });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: foreign.id.value,
      isPinned: true,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2001 });
    expect((await memoRepository.findByIdAndUserId(foreign.id, foreign.userId))?.isPinned).toBe(
      false,
    );
  });
});

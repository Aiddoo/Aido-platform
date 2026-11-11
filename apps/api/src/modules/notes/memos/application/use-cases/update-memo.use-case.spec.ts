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

import { MemoLockKeys } from "../memos.lock-keys.js";
import { type UpdateMemoDependencies, UpdateMemoUseCase } from "./update-memo.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const NOW = MEMO_FIXTURE_NOW.add({ seconds: 1 });

function createUpdateMemoUseCase(overrides: Partial<UpdateMemoDependencies> = {}) {
  return new UpdateMemoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    memoRepository: new InMemoryMemoRepository(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("UpdateMemoUseCase — 메모 내용 수정", () => {
  it("메모 잠금 안에서 내용만 바꾸고 고정·순서·생성 시각은 두며 수정 시각을 옮긴다", async () => {
    // Given
    const original = createMemoFixture({ content: "수정 전", isPinned: true, sortOrder: 4 });
    const memoRepository = new InMemoryMemoRepository([original]);
    const mutationLock = new RecordingMutationLock();
    const useCase = createUpdateMemoUseCase({ memoRepository, mutationLock });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: original.id.value,
      content: "수정 후",
    });

    // Then
    const expected = { ...original.toPrimitives(), content: "수정 후", updatedAt: NOW };
    expect(memo.toPrimitives()).toEqual(expected);
    expect((await memoRepository.findByIdAndUserId(original.id, USER_ID))?.toPrimitives()).toEqual(
      expected,
    );
    expect(mutationLock.acquiredKeys).toEqual([
      [MemoLockKeys.memo(original.id), MemoLockKeys.sortOrder(USER_ID)],
    ]);
  });

  it("같은 내용이면 저장하지 않아 수정 시각이 그대로다", async () => {
    // Given
    const original = createMemoFixture({ content: "그대로" });
    const memoRepository = new InMemoryMemoRepository([original]);
    const logger = new SilentLogger();
    const useCase = createUpdateMemoUseCase({ memoRepository, logger });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: original.id.value,
      content: "그대로",
    });

    // Then
    expect(memo.toPrimitives().updatedAt).toEqual(MEMO_FIXTURE_NOW);
    expect(
      (await memoRepository.findByIdAndUserId(original.id, USER_ID))?.toPrimitives().updatedAt,
    ).toEqual(MEMO_FIXTURE_NOW);
    expect(logger.messages).toEqual([]);
  });

  it("남의 메모는 빈 내용보다 MEMO_2001을 먼저 던지고 바꾸지 않는다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID, content: "남의 메모" });
    const memoRepository = new InMemoryMemoRepository([foreign]);
    const useCase = createUpdateMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: foreign.id.value,
      content: "",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2001,
      details: { memoId: foreign.id.value },
    });
    expect(
      (await memoRepository.findByIdAndUserId(foreign.id, foreign.userId))?.content.value,
    ).toBe("남의 메모");
  });

  it("빈 내용은 SYS_0002로 거절하고 저장된 내용을 둔다", async () => {
    // Given
    const original = createMemoFixture({ content: "유지할 메모" });
    const memoRepository = new InMemoryMemoRepository([original]);
    const useCase = createUpdateMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: original.id.value,
      content: "",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect((await memoRepository.findByIdAndUserId(original.id, USER_ID))?.toPrimitives()).toEqual(
      original.toPrimitives(),
    );
  });
});

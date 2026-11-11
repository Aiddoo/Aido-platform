import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

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
import { type CreateMemoDependencies, CreateMemoUseCase } from "./create-memo.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const NOW = MEMO_FIXTURE_NOW.add({ hours: 1 });

function createCreateMemoUseCase(overrides: Partial<CreateMemoDependencies> = {}) {
  return new CreateMemoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    memoRepository: new InMemoryMemoRepository(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("CreateMemoUseCase — 메모 만들기", () => {
  it("사용자 순서 잠금 안에서 그 사용자의 마지막 순서 다음에 원문 그대로 만든다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository([
      createMemoFixture({ id: 1, sortOrder: 7 }),
      createMemoFixture({ id: 2, sortOrder: 50, userId: MEMO_FIXTURE_OTHER_USER_ID }),
    ]);
    const mutationLock = new RecordingMutationLock();
    const useCase = createCreateMemoUseCase({ memoRepository, mutationLock });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "회의 준비\n\n자료 확인",
    });

    // Then
    expect(memo.toPrimitives()).toEqual({
      id: 3,
      userId: MEMO_FIXTURE_USER_ID,
      content: "회의 준비\n\n자료 확인",
      isPinned: false,
      sortOrder: 8,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect((await memoRepository.findByIdAndUserId(memo.id, USER_ID))?.toPrimitives()).toEqual(
      memo.toPrimitives(),
    );
    expect(mutationLock.acquiredKeys).toEqual([[MemoLockKeys.sortOrder(USER_ID)]]);
  });

  it("첫 메모는 정렬 순서 0이다", async () => {
    // Given
    const useCase = createCreateMemoUseCase();

    // When
    const memo = await useCase.execute({ userId: MEMO_FIXTURE_USER_ID, content: "첫 메모" });

    // Then
    expect(memo.sortOrder).toBe(0);
  });

  it("한도에 도달하면 빈 내용보다 MEMO_2003을 먼저 던지고 저장하지 않는다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository(
      Array.from({ length: MEMO_LIMITS.MAX_PER_USER }, (_, index) =>
        createMemoFixture({ id: index + 1, sortOrder: index }),
      ),
    );
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, content: "" });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2003,
      details: { current: MEMO_LIMITS.MAX_PER_USER, limit: MEMO_LIMITS.MAX_PER_USER },
    });
    expect(memoRepository.size).toBe(MEMO_LIMITS.MAX_PER_USER);
  });

  it("빈 내용은 SYS_0002로 거절하고 저장하지 않는다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository();
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({ userId: MEMO_FIXTURE_USER_ID, content: "" });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(memoRepository.size).toBe(0);
  });
});

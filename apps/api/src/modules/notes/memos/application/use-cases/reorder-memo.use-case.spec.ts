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

import type { Memo } from "../../domain/memo.aggregate.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { type ReorderMemoDependencies, ReorderMemoUseCase } from "./reorder-memo.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const NOW = MEMO_FIXTURE_NOW.add({ seconds: 1 });

function createReorderMemoUseCase(overrides: Partial<ReorderMemoDependencies> = {}) {
  return new ReorderMemoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    memoRepository: new InMemoryMemoRepository(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

async function readSortOrders(
  memoRepository: InMemoryMemoRepository,
  memos: readonly Memo[],
): Promise<(number | undefined)[]> {
  const sortOrders = [];
  for (const memo of memos) {
    sortOrders.push((await memoRepository.findByIdAndUserId(memo.id, memo.userId))?.sortOrder);
  }
  return sortOrders;
}

describe("ReorderMemoUseCase — 메모 순서 변경", () => {
  it("옮길 메모가 없으면 기준 메모 오류보다 MEMO_2001을 먼저 던진다", async () => {
    // Given
    const useCase = createReorderMemoUseCase();

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: 100,
      targetMemoId: 101,
      position: "before",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2001,
      details: { memoId: 100 },
    });
  });

  it("남의 기준 메모는 MEMO_2002로 거절하고 순서를 둔다", async () => {
    // Given
    const memo = createMemoFixture({ id: 1, sortOrder: 3 });
    const target = createMemoFixture({ id: 2, sortOrder: 0, userId: MEMO_FIXTURE_OTHER_USER_ID });
    const memoRepository = new InMemoryMemoRepository([memo, target]);
    const useCase = createReorderMemoUseCase({ memoRepository });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      targetMemoId: target.id.value,
      position: "before",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2002,
      details: { targetMemoId: target.id.value },
    });
    expect(await readSortOrders(memoRepository, [memo, target])).toEqual([3, 0]);
  });

  it("자신을 기준으로 다시 보내면 아무것도 쓰지 않고 수정 시각이 그대로다", async () => {
    // Given
    const memo = createMemoFixture({ sortOrder: 3 });
    const memoRepository = new InMemoryMemoRepository([memo]);
    const useCase = createReorderMemoUseCase({ memoRepository });

    // When
    const result = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      targetMemoId: memo.id.value,
      position: "before",
    });

    // Then
    expect(result.toPrimitives()).toEqual(memo.toPrimitives());
    expect((await memoRepository.findByIdAndUserId(memo.id, USER_ID))?.toPrimitives()).toEqual(
      memo.toPrimitives(),
    );
  });

  it("기준 메모 앞으로 옮기면 사이 메모만 밀고 남의 메모 순서는 둔다", async () => {
    // Given
    const first = createMemoFixture({ id: 1, sortOrder: 0 });
    const second = createMemoFixture({ id: 2, sortOrder: 1 });
    const last = createMemoFixture({ id: 3, sortOrder: 2 });
    const foreign = createMemoFixture({ id: 4, sortOrder: 1, userId: MEMO_FIXTURE_OTHER_USER_ID });
    const memoRepository = new InMemoryMemoRepository([first, second, last, foreign]);
    const mutationLock = new RecordingMutationLock();
    const useCase = createReorderMemoUseCase({ memoRepository, mutationLock });

    // When
    const moved = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: last.id.value,
      targetMemoId: first.id.value,
      position: "before",
    });

    // Then
    expect(moved.toPrimitives()).toMatchObject({ sortOrder: 0, updatedAt: NOW });
    expect(await readSortOrders(memoRepository, [first, second, last, foreign])).toEqual([
      1, 2, 0, 1,
    ]);
    expect(mutationLock.acquiredKeys).toEqual([
      [MemoLockKeys.memo(last.id), MemoLockKeys.sortOrder(USER_ID)],
    ]);
  });

  it.each([
    { position: "after", memoIndex: 0, expected: [2, 0, 1] },
    { position: "before", memoIndex: 2, expected: [1, 2, 0] },
  ] as const)(
    "기준 메모 없이 $position이면 그쪽 끝으로 옮기고 사이 메모를 한 칸씩 옮긴다",
    async ({ position, memoIndex, expected }) => {
      // Given
      const memos = [0, 1, 2].map((sortOrder) =>
        createMemoFixture({ id: sortOrder + 1, sortOrder }),
      );
      const memoRepository = new InMemoryMemoRepository(memos);
      const useCase = createReorderMemoUseCase({ memoRepository });

      // When
      await useCase.execute({
        userId: MEMO_FIXTURE_USER_ID,
        memoId: memos[memoIndex]?.id.value ?? 0,
        position,
      });

      // Then
      expect(await readSortOrders(memoRepository, memos)).toEqual(expected);
    },
  );
});

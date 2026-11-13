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

import { fingerprintMemoCreation } from "../../domain/memo-creation-request.domain-service.js";
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
      idempotencyKey: null,
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
      idempotencyKey: null,
      requestHash: null,
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
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "첫 메모",
      idempotencyKey: null,
    });

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
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "",
      idempotencyKey: null,
    });

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
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "",
      idempotencyKey: null,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(memoRepository.size).toBe(0);
  });

  it("응답을 받지 못해 같은 키로 다시 보내면 처음 만든 메모를 돌려주고 새로 만들지 않는다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository();
    const useCase = createCreateMemoUseCase({ memoRepository });
    const command = {
      userId: MEMO_FIXTURE_USER_ID,
      content: "시간 초과된 메모",
      idempotencyKey: "memo-create-1",
    };
    const first = await useCase.execute(command);

    // When
    const retried = await useCase.execute(command);

    // Then
    expect(retried.toPrimitives()).toEqual(first.toPrimitives());
    expect(memoRepository.size).toBe(1);
  });

  it("같은 키의 재시도는 처음 메모로 한도가 찼어도 MEMO_2003 없이 그 메모를 돌려준다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository([
      ...Array.from({ length: MEMO_LIMITS.MAX_PER_USER - 1 }, (_, index) =>
        createMemoFixture({ id: index + 1, sortOrder: index }),
      ),
      createMemoFixture({
        id: MEMO_LIMITS.MAX_PER_USER,
        sortOrder: MEMO_LIMITS.MAX_PER_USER - 1,
        idempotencyKey: "memo-create-1",
        requestHash: fingerprintMemoCreation(USER_ID, "장보기: 우유, 계란, 빵"),
      }),
    ]);
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const retried = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "장보기: 우유, 계란, 빵",
      idempotencyKey: "memo-create-1",
    });

    // Then
    expect(retried.id.value).toBe(MEMO_LIMITS.MAX_PER_USER);
    expect(memoRepository.size).toBe(MEMO_LIMITS.MAX_PER_USER);
  });

  it("다른 사용자가 같은 키를 보내면 그 사용자의 메모를 새로 만든다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository([
      createMemoFixture({
        id: 1,
        idempotencyKey: "memo-create-1",
        requestHash: fingerprintMemoCreation(USER_ID, "장보기: 우유, 계란, 빵"),
      }),
    ]);
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_OTHER_USER_ID,
      content: "다른 사람 메모",
      idempotencyKey: "memo-create-1",
    });

    // Then
    expect(memo.toPrimitives()).toMatchObject({
      id: 2,
      userId: MEMO_FIXTURE_OTHER_USER_ID,
      idempotencyKey: "memo-create-1",
    });
    expect(memoRepository.size).toBe(2);
  });

  it("같은 키로 글이 다른 저장을 보내면 MEMO_2004로 거절하고 처음 메모를 바꾸지 않는다", async () => {
    // Given
    const memoRepository = new InMemoryMemoRepository();
    const useCase = createCreateMemoUseCase({ memoRepository });
    const first = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "처음 글",
      idempotencyKey: "memo-create-1",
    });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "고친 글",
      idempotencyKey: "memo-create-1",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2004 });
    expect((await memoRepository.findByIdAndUserId(first.id, USER_ID))?.content.value).toBe(
      "처음 글",
    );
    expect(memoRepository.size).toBe(1);
  });

  it("잠금을 지나 같은 키 생성이 겹쳐 저장이 막히면 새 트랜잭션에서 먼저 저장된 메모를 돌려준다", async () => {
    // Given
    const memoRepository = new LookupRacedMemoRepository([
      createMemoFixture({
        id: 1,
        idempotencyKey: "memo-create-1",
        requestHash: fingerprintMemoCreation(USER_ID, "장보기: 우유, 계란, 빵"),
      }),
    ]);
    const useCase = createCreateMemoUseCase({ memoRepository });

    // When
    const memo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      content: "장보기: 우유, 계란, 빵",
      idempotencyKey: "memo-create-1",
    });

    // Then
    expect(memo.id.value).toBe(1);
    expect(memoRepository.size).toBe(1);
  });
});

/** 첫 조회만 키로 만든 메모를 못 본 척해 잠금을 지나 겹친 생성을 흉내 낸다. 저장은 unique 제약처럼 막는다 */
class LookupRacedMemoRepository extends InMemoryMemoRepository {
  #isFirstLookup = true;

  override async findByIdempotencyKey(userId: UserId, idempotencyKey: string) {
    if (this.#isFirstLookup) {
      this.#isFirstLookup = false;
      return null;
    }
    return super.findByIdempotencyKey(userId, idempotencyKey);
  }
}

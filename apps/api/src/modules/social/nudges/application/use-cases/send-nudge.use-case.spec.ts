import { ErrorCode } from "@aido/api/errors";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { NudgeTargetTodo } from "#api/modules/social/nudges/domain/nudge-target-todo.vo";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import { RecordingNudgeNotifier } from "#test/doubles/social/recording-nudge-notifier";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import { StubNudgeLimitReader } from "#test/doubles/social/stub-nudge-limit-reader";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
  NUDGE_FIXTURE_TODAY,
  type NudgeTodoSeed,
} from "#test/fixtures/social/nudge.fixture";

import { NudgeLockKeys } from "../nudges.lock-keys.js";
import { type SendNudgeDependencies, SendNudgeUseCase } from "./send-nudge.use-case.js";

const SENDER_ID = UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID);
const DAILY_LIMIT = 3;

// 잠금과 대상 할 일 조회 순서를 남기고, 잠금을 기다리는 동안 시계를 흘린다
class OrderedLock extends MutationLockPort {
  readonly #events: string[];
  readonly #clock: FixedClock | null;

  constructor(events: string[], clock: FixedClock | null = null) {
    super();
    this.#events = events;
    this.#clock = clock;
  }

  async acquire(): Promise<void> {
    this.#events.push("lock");
    this.#clock?.advanceBy({ milliseconds: 200 });
  }
}

class OrderedNudgeRepository extends InMemoryNudgeRepository {
  readonly #events: string[];

  constructor(events: string[]) {
    super();
    this.#events = events;
  }

  override async findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null> {
    this.#events.push("target");
    return super.findTargetTodo(todoId);
  }
}

function createFollowReader(): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  mutualFriendReader.addMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
  mutualFriendReader.setDisplayName(NUDGE_FIXTURE_SENDER_ID, "보낸이");
  return mutualFriendReader;
}

async function repositoryWithTodo(
  seed: Partial<NudgeTodoSeed> = {},
  repository = new InMemoryNudgeRepository(),
): Promise<{ readonly nudgeRepository: InMemoryNudgeRepository; readonly todoId: number }> {
  const todoId = await repository.addTodo(createNudgeTodoSeed(seed));
  return { nudgeRepository: repository, todoId };
}

function createSendNudgeUseCase(overrides: Partial<SendNudgeDependencies> = {}) {
  return new SendNudgeUseCase({
    countCache: new PassThroughCountCache(),
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    nudgeRepository: new InMemoryNudgeRepository(),
    limitReader: new StubNudgeLimitReader(DAILY_LIMIT),
    mutualFriendReader: createFollowReader(),
    notifier: new RecordingNudgeNotifier(),
    clock: new FixedClock(NUDGE_FIXTURE_NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("SendNudgeUseCase — 친구의 할 일에 콕 보내기", () => {
  it("오늘의 공개 할 일에 콕을 저장하고 할 일 제목·표시 이름으로 알림을 보낸다", async () => {
    // Given
    const { nudgeRepository, todoId } = await repositoryWithTodo();
    const mutationLock = new RecordingMutationLock();
    const notifier = new RecordingNudgeNotifier();
    const countCache = new PassThroughCountCache();
    const useCase = createSendNudgeUseCase({ nudgeRepository, mutationLock, notifier, countCache });

    // When
    const nudge = await useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      message: "같이 해요",
      timezone: "UTC",
    });

    // Then
    expect((await nudgeRepository.findById(nudge.id))?.toPrimitives()).toMatchObject({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      message: "같이 해요",
      createdAt: NUDGE_FIXTURE_NOW,
    });
    expect(mutationLock.acquiredKeys).toEqual([
      [NudgeLockKeys.dailyQuota(SENDER_ID), NudgeLockKeys.cooldown(SENDER_ID, todoId)],
    ]);
    expect(countCache.invalidatedUserIds).toEqual([
      NUDGE_FIXTURE_SENDER_ID,
      NUDGE_FIXTURE_RECEIVER_ID,
    ]);
    expect(notifier.sent).toEqual([
      {
        nudgeId: nudge.id.value,
        senderId: NUDGE_FIXTURE_SENDER_ID,
        receiverId: NUDGE_FIXTURE_RECEIVER_ID,
        senderName: "보낸이",
        todoId,
        todoTitle: "운동하기",
        message: "같이 해요",
      },
    ]);
  });

  it.each([
    {
      name: "자기 자신",
      receiverId: NUDGE_FIXTURE_SENDER_ID,
      todo: {},
      expected: (_todoId: number) => ({ errorCode: ErrorCode.NUDGE_1104 }),
    },
    {
      name: "친구가 아닌 사용자",
      receiverId: NUDGE_FIXTURE_OTHER_USER_ID,
      todo: {},
      expected: (_todoId: number) => ({
        errorCode: ErrorCode.NUDGE_1103,
        details: { targetUserId: NUDGE_FIXTURE_OTHER_USER_ID },
      }),
    },
    {
      name: "남의 할 일",
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todo: { ownerId: NUDGE_FIXTURE_OTHER_USER_ID },
      expected: (todoId: number) => ({ errorCode: ErrorCode.TODO_0801, details: { todoId } }),
    },
    {
      name: "비공개 할 일",
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todo: { visibility: "PRIVATE" as const },
      expected: (todoId: number) => ({ errorCode: ErrorCode.TODO_0801, details: { todoId } }),
    },
    {
      name: "오늘이 아닌 할 일",
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todo: { startDate: NUDGE_FIXTURE_TODAY.subtract({ days: 1 }) },
      expected: (todoId: number) => ({ errorCode: ErrorCode.NUDGE_1106, details: { todoId } }),
    },
  ])("$name에는 보내지 않고 저장·알림도 남기지 않는다", async ({ receiverId, todo, expected }) => {
    // Given
    const { nudgeRepository, todoId } = await repositoryWithTodo(todo);
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeUseCase({ nudgeRepository, notifier });

    // When
    const result = useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId,
      todoId,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject(expected(todoId));
    expect(nudgeRepository.size).toBe(0);
    expect(notifier.sent).toEqual([]);
  });

  it("없는 할 일은 TODO_0801로 거절한다", async () => {
    // Given
    const useCase = createSendNudgeUseCase();

    // When
    const result = useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId: 404,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
      details: { todoId: 404 },
    });
  });

  it("오늘 한도를 다 쓰면 NUDGE_1101과 서버 계산 featureQuota로 거절한다", async () => {
    // Given
    const { nudgeRepository, todoId } = await repositoryWithTodo();
    for (let index = 0; index < DAILY_LIMIT; index += 1) {
      await nudgeRepository.save(
        createNudgeFixture({
          id: index + 1,
          todoId: todoId + index + 1,
          createdAt: NUDGE_FIXTURE_NOW.subtract({ minutes: index + 1 }),
        }),
      );
    }
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeUseCase({ nudgeRepository, notifier });

    // When
    const result = useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1101,
      details: {
        charged: false,
        featureQuota: {
          feature: "NUDGE",
          limit: DAILY_LIMIT,
          used: DAILY_LIMIT,
          remaining: 0,
          resetsAt: "2026-07-27T00:00:00.000Z",
        },
      },
    });
    expect(nudgeRepository.size).toBe(DAILY_LIMIT);
    expect(notifier.sent).toEqual([]);
  });

  it("같은 할 일에 24시간 안에 다시 찌르면 남은 초와 함께 NUDGE_1102로 거절한다", async () => {
    // Given
    const { nudgeRepository, todoId } = await repositoryWithTodo();
    await nudgeRepository.save(
      createNudgeFixture({ todoId, createdAt: NUDGE_FIXTURE_NOW.subtract({ seconds: 1 }) }),
    );
    const useCase = createSendNudgeUseCase({ nudgeRepository });

    // When
    const result = useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1102,
      details: { targetUserId: NUDGE_FIXTURE_RECEIVER_ID, remainingSeconds: 86_399 },
    });
    expect(nudgeRepository.size).toBe(1);
  });

  it("잠근 뒤 대상 할 일을 읽고, 자정을 넘겨 기다려도 요청 시각의 날짜와 생성 시각을 쓴다", async () => {
    // Given
    const requestedAt = Temporal.Instant.from("2026-07-26T14:59:59.900Z");
    const clock = new FixedClock(requestedAt);
    const events: string[] = [];
    const { nudgeRepository, todoId } = await repositoryWithTodo(
      {},
      new OrderedNudgeRepository(events),
    );
    const useCase = createSendNudgeUseCase({
      nudgeRepository,
      mutationLock: new OrderedLock(events, clock),
      clock,
    });

    // When
    const nudge = await useCase.execute({
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      timezone: "Asia/Seoul",
    });

    // Then
    expect(events).toEqual(["lock", "target"]);
    expect(nudge.createdAt).toEqual(requestedAt);
  });
});

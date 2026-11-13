import { ErrorCode } from "@aido/api/errors";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { NudgeInteractionNotification } from "#api/modules/social/nudges/application/ports/nudge-notifier.port";
import type { NudgeInteractionTodoReadModel } from "#api/modules/social/nudges/application/read-models/nudge-interaction.read-model";
import type { NudgeReadModel } from "#api/modules/social/nudges/application/read-models/nudge.read-model";
import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import type { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryNudgeReader } from "#test/doubles/social/in-memory-nudge.reader";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { RecordingNudgeNotifier } from "#test/doubles/social/recording-nudge-notifier";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { type ReplyToNudgeDependencies, ReplyToNudgeUseCase } from "./reply-to-nudge.use-case.js";

const NUDGE_ID = NudgeId.reconstitute(1);
const LATER = NUDGE_FIXTURE_NOW.add({ seconds: 10 });

class CountingNudgeRepository extends InMemoryNudgeRepository {
  saveCount = 0;
  interactionReadCount = 0;

  override async save(nudge: Nudge): Promise<void> {
    this.saveCount += 1;
    await super.save(nudge);
  }
}

// 콕을 읽은 횟수를 저장소에 남겨 기능이 꺼졌을 때 읽지 않았는지 본다
class CountingNudgeReader extends InMemoryNudgeReader {
  readonly #repository: CountingNudgeRepository;

  constructor(repository: CountingNudgeRepository) {
    super(repository);
    this.#repository = repository;
  }

  override async findInteraction(
    nudgeId: NudgeId,
    viewerId: UserId,
  ): Promise<NudgeReadModel | null> {
    this.#repository.interactionReadCount += 1;
    return super.findInteraction(nudgeId, viewerId);
  }
}

// 행 잠금을 기다리는 사이 할 일이 비공개로 바뀐 상황
class TurnsPrivateWhileLockingRepository extends CountingNudgeRepository {
  override async lockInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    this.updateTodo(todoId.value, { visibility: "PRIVATE" });
    return super.lockInteractionTodo(todoId, ownerId);
  }
}

class FailingNudgeNotifier extends RecordingNudgeNotifier {
  readonly error = new Error("알림 저장 실패");

  override async recordInteraction(_notification: NudgeInteractionNotification): Promise<void> {
    throw this.error;
  }
}

async function seedReceivedNudge(
  repository: CountingNudgeRepository = new CountingNudgeRepository(),
): Promise<CountingNudgeRepository> {
  repository.addUser({
    id: NUDGE_FIXTURE_RECEIVER_ID,
    userTag: "RECEIVE1",
    name: "받은이",
    profileImage: null,
  });
  const todoId = await repository.addTodo(createNudgeTodoSeed());
  await repository.save(createNudgeFixture({ id: NUDGE_ID.value, todoId }));
  return repository;
}

function createFollowReader(): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  mutualFriendReader.addMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
  return mutualFriendReader;
}

function createReplyToNudgeUseCase(
  nudgeRepository: CountingNudgeRepository,
  overrides: Partial<ReplyToNudgeDependencies> = {},
) {
  return new ReplyToNudgeUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    nudgeRepository,
    nudgeReader: new CountingNudgeReader(nudgeRepository),
    interactionConfig: { isEnabled: true },
    mutualFriendReader: createFollowReader(),
    notifier: new RecordingNudgeNotifier(),
    clock: new FixedClock(NUDGE_FIXTURE_NOW),
    ...overrides,
  });
}

const COMMAND = {
  userId: NUDGE_FIXTURE_RECEIVER_ID,
  nudgeId: NUDGE_ID.value,
  replyKind: "STARTING",
} as const;

describe("ReplyToNudgeUseCase — 받은 콕에 답장", () => {
  it("첫 답장은 저장하고 보낸 친구에게 알림을 남기며 할 일 완료 상태는 바꾸지 않는다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const notifier = new RecordingNudgeNotifier();
    const useCase = createReplyToNudgeUseCase(nudgeRepository, { notifier });

    // When
    const interaction = await useCase.execute(COMMAND);

    // Then
    expect(interaction).toMatchObject({
      replyKind: "STARTING",
      repliedAt: NUDGE_FIXTURE_NOW,
      replyUpdatedAt: NUDGE_FIXTURE_NOW,
      readAt: NUDGE_FIXTURE_NOW,
      isAvailable: true,
    });
    expect((await nudgeRepository.findById(NUDGE_ID))?.replyKind).toBe("STARTING");
    expect(interaction.todo.completed).toBe(false);
    expect(notifier.interactions).toEqual([
      {
        kind: "reply",
        nudgeId: NUDGE_ID.value,
        todoId: interaction.todoId,
        actorId: NUDGE_FIXTURE_RECEIVER_ID,
        recipientId: NUDGE_FIXTURE_SENDER_ID,
        actorName: "받은이",
        todoTitle: "운동하기",
        replyKind: "STARTING",
      },
    ]);
  });

  it("같은 답장을 다시 보내면 저장·알림을 반복하지 않고 처음 시각을 둔다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const notifier = new RecordingNudgeNotifier();
    const clock = new FixedClock(NUDGE_FIXTURE_NOW);
    const useCase = createReplyToNudgeUseCase(nudgeRepository, { notifier, clock });
    await useCase.execute(COMMAND);
    clock.advanceBy({ seconds: 10 });

    // When
    const interaction = await useCase.execute(COMMAND);

    // Then
    expect(interaction.replyUpdatedAt).toEqual(NUDGE_FIXTURE_NOW);
    expect(nudgeRepository.saveCount).toBe(2);
    expect(notifier.interactions).toHaveLength(1);
  });

  it("답장을 바꾸면 첫 답장 시각을 두고 변경 시각만 바꾸며 알림은 다시 보내지 않는다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const notifier = new RecordingNudgeNotifier();
    const clock = new FixedClock(NUDGE_FIXTURE_NOW);
    const useCase = createReplyToNudgeUseCase(nudgeRepository, { notifier, clock });
    await useCase.execute(COMMAND);
    clock.advanceBy({ seconds: 10 });

    // When
    const interaction = await useCase.execute({ ...COMMAND, replyKind: "LATER" });

    // Then
    expect(interaction).toMatchObject({
      replyKind: "LATER",
      repliedAt: NUDGE_FIXTURE_NOW,
      replyUpdatedAt: LATER,
    });
    expect(notifier.interactions).toHaveLength(1);
  });

  it.each([
    { state: "보낸 사람이 답장", code: ErrorCode.NUDGE_1105 },
    { state: "없는 콕", code: ErrorCode.NUDGE_1105 },
    { state: "친구 관계 해제", code: ErrorCode.NUDGE_1109 },
    { state: "비공개 할 일", code: ErrorCode.NUDGE_1109 },
    { state: "지운 할 일", code: ErrorCode.NUDGE_1105 },
  ])("$state이면 $code로 거절하고 답장을 저장하지 않는다", async ({ state, code }) => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const mutualFriendReader = createFollowReader();
    const notifier = new RecordingNudgeNotifier();
    const todoId = (await nudgeRepository.findById(NUDGE_ID))?.todoId ?? 0;
    if (state === "친구 관계 해제") {
      mutualFriendReader.removeMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
    }
    if (state === "비공개 할 일") {
      nudgeRepository.updateTodo(todoId, { visibility: "PRIVATE" });
    }
    if (state === "지운 할 일") {
      nudgeRepository.deleteTodo(todoId);
    }
    const useCase = createReplyToNudgeUseCase(nudgeRepository, { mutualFriendReader, notifier });

    // When
    const result = useCase.execute({
      ...COMMAND,
      userId: state === "보낸 사람이 답장" ? NUDGE_FIXTURE_SENDER_ID : NUDGE_FIXTURE_RECEIVER_ID,
      nudgeId: state === "없는 콕" ? 404 : NUDGE_ID.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
    expect((await nudgeRepository.findById(NUDGE_ID))?.replyKind ?? null).toBeNull();
    expect(notifier.interactions).toEqual([]);
  });

  it("행 잠금 뒤 할 일이 비공개가 됐다면 답장을 저장하지 않는다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge(new TurnsPrivateWhileLockingRepository());
    const useCase = createReplyToNudgeUseCase(nudgeRepository);

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1109 });
    expect((await nudgeRepository.findById(NUDGE_ID))?.replyKind).toBeNull();
  });

  it("기능이 꺼져 있으면 콕을 읽기 전에 NUDGE_1111로 거절한다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const useCase = createReplyToNudgeUseCase(nudgeRepository, {
      interactionConfig: { isEnabled: false },
    });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1111 });
    expect(nudgeRepository.interactionReadCount).toBe(0);
  });

  it("알림 기록이 실패하면 원래 오류를 그대로 던져 UnitOfWork가 되돌리게 한다", async () => {
    // Given
    const nudgeRepository = await seedReceivedNudge();
    const notifier = new FailingNudgeNotifier();
    const useCase = createReplyToNudgeUseCase(nudgeRepository, { notifier });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toBe(notifier.error);
    expect(notifier.interactions).toEqual([]);
  });
});

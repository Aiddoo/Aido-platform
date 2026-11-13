import { ErrorCode } from "@aido/api/errors";

import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import type { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
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
  type NudgeTodoSeed,
} from "#test/fixtures/social/nudge.fixture";

import {
  type SendNudgeThanksDependencies,
  SendNudgeThanksUseCase,
} from "./send-nudge-thanks.use-case.js";

const THANKED_AT = NUDGE_FIXTURE_NOW.add({ hours: 3 });

class FailingThanksRepository extends InMemoryNudgeRepository {
  readonly error = new Error("배치 저장 실패");

  override async saveAll(_nudges: readonly Nudge[]): Promise<void> {
    throw this.error;
  }
}

async function seedCompletedTodo(
  nudgeRepository: InMemoryNudgeRepository,
  senderIds: readonly string[],
  todo: Partial<NudgeTodoSeed> = {},
): Promise<number> {
  const todoId = await nudgeRepository.addTodo(createNudgeTodoSeed({ completed: true, ...todo }));
  for (const [index, senderId] of senderIds.entries()) {
    await nudgeRepository.save(createNudgeFixture({ id: index + 1, senderId, todoId }));
  }
  return todoId;
}

function createFollowReader(friendIds: readonly string[]): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  for (const friendId of friendIds) {
    mutualFriendReader.addMutual(friendId, NUDGE_FIXTURE_RECEIVER_ID);
  }
  return mutualFriendReader;
}

function createSendNudgeThanksUseCase(
  nudgeRepository: InMemoryNudgeRepository,
  overrides: Partial<SendNudgeThanksDependencies> = {},
) {
  return new SendNudgeThanksUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    nudgeRepository,
    nudgeReader: new InMemoryNudgeReader(nudgeRepository),
    interactionConfig: { isEnabled: true },
    mutualFriendReader: createFollowReader([NUDGE_FIXTURE_SENDER_ID]),
    notifier: new RecordingNudgeNotifier(),
    clock: new FixedClock(THANKED_AT),
    ...overrides,
  });
}

describe("SendNudgeThanksUseCase — 완료한 할 일의 콕에 감사", () => {
  it("친구 천 명의 감사를 100명씩 저장하고 알림도 같은 배치로 남긴다", async () => {
    // Given
    const friendIds = Array.from({ length: 1000 }, (_, index) => `friend-${index}`);
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, friendIds);
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeThanksUseCase(nudgeRepository, {
      mutualFriendReader: createFollowReader(friendIds),
      notifier,
    });

    // When
    const result = await useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      throughNudgeId: 1000,
    });

    // Then
    expect(result).toEqual({ sentCount: 1000 });
    expect(nudgeRepository.saveAllBatchSizes).toEqual(Array(10).fill(100));
    expect(notifier.interactionBatchSizes).toEqual(Array(10).fill(100));
    expect((await nudgeRepository.findById(NudgeId.reconstitute(1)))?.thankedAt).toEqual(
      THANKED_AT,
    );
    expect(notifier.interactions[0]).toEqual({
      kind: "thanks",
      nudgeId: 1000,
      todoId,
      actorId: NUDGE_FIXTURE_RECEIVER_ID,
      recipientId: "friend-999",
      actorName: NUDGE_FIXTURE_RECEIVER_ID,
      todoTitle: "운동하기",
    });
  });

  it("이미 감사한 친구에게는 저장·알림 없이 0명을 보낸 것으로 끝난다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await nudgeRepository.addTodo(createNudgeTodoSeed({ completed: true }));
    await nudgeRepository.save(createNudgeFixture({ todoId, thankedAt: NUDGE_FIXTURE_NOW }));
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeThanksUseCase(nudgeRepository, { notifier });

    // When
    const result = await useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      throughNudgeId: 1,
    });

    // Then
    expect(result).toEqual({ sentCount: 0 });
    expect(nudgeRepository.saveAllBatchSizes).toEqual([]);
    expect(notifier.interactions).toEqual([]);
  });

  it("배치 저장이 실패하면 원래 오류를 던지고 그 배치의 알림은 남기지 않는다", async () => {
    // Given
    const nudgeRepository = new FailingThanksRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, [NUDGE_FIXTURE_SENDER_ID]);
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeThanksUseCase(nudgeRepository, { notifier });

    // When
    const result = useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      throughNudgeId: 1,
    });

    // Then
    await expect(result).rejects.toBe(nudgeRepository.error);
    expect((await nudgeRepository.findById(NudgeId.reconstitute(1)))?.thankedAt).toBeNull();
    expect(notifier.interactions).toEqual([]);
  });

  it.each([
    {
      name: "내 할 일이 아님",
      todo: { ownerId: NUDGE_FIXTURE_SENDER_ID },
      code: ErrorCode.TODO_0801,
    },
    { name: "완료하지 않은 할 일", todo: { completed: false }, code: ErrorCode.NUDGE_1110 },
    { name: "비공개 할 일", todo: { visibility: "PRIVATE" as const }, code: ErrorCode.NUDGE_1109 },
  ])("$name이면 $code로 거절한다", async ({ todo, code }) => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, [], todo);
    const useCase = createSendNudgeThanksUseCase(nudgeRepository);

    // When
    const result = useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      throughNudgeId: 1,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
  });

  it("미리보기 경계 콕이 이 할 일에서 받은 콕이 아니면 NUDGE_1105로 거절한다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    await seedCompletedTodo(nudgeRepository, [NUDGE_FIXTURE_SENDER_ID]);
    const otherTodoId = await nudgeRepository.addTodo(createNudgeTodoSeed({ completed: true }));
    const useCase = createSendNudgeThanksUseCase(nudgeRepository);

    // When
    const result = useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId: otherTodoId,
      throughNudgeId: 1,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1105 });
  });

  it("서버 설정으로 답장·감사가 꺼졌으면 저장·알림 없이 NUDGE_1111로 거절한다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, [NUDGE_FIXTURE_SENDER_ID]);
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendNudgeThanksUseCase(nudgeRepository, {
      interactionConfig: { isEnabled: false },
      notifier,
    });

    // When
    const result = useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      throughNudgeId: 1,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NUDGE_1111 });
    expect((await nudgeRepository.findById(NudgeId.reconstitute(1)))?.thankedAt).toBeNull();
    expect(notifier.interactions).toEqual([]);
  });
});

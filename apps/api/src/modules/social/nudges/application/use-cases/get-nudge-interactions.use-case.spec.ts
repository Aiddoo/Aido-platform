import { ErrorCode } from "@aido/api/errors";

import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { GetNudgeInteractionUseCase } from "./get-nudge-interaction.use-case.js";
import { GetNudgeInteractionsUseCase } from "./get-nudge-interactions.use-case.js";

async function seedInteractions(): Promise<InMemoryNudgeRepository> {
  const nudgeReader = new InMemoryNudgeRepository();
  const publicTodoId = await nudgeReader.addTodo(createNudgeTodoSeed());
  const privateTodoId = await nudgeReader.addTodo(createNudgeTodoSeed({ visibility: "PRIVATE" }));
  await nudgeReader.save(createNudgeFixture({ id: 1, todoId: publicTodoId }));
  await nudgeReader.save(
    createNudgeFixture({ id: 2, todoId: publicTodoId, senderId: NUDGE_FIXTURE_OTHER_USER_ID }),
  );
  await nudgeReader.save(createNudgeFixture({ id: 3, todoId: privateTodoId }));
  return nudgeReader;
}

function createFollowReader(): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  mutualFriendReader.addMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
  return mutualFriendReader;
}

describe("콕 주고받기 조회", () => {
  it("받은 콕 목록은 id 내림차순으로 나누고, 지금 친구의 공개 할 일 콕만 답장할 수 있다", async () => {
    // Given
    const useCase = new GetNudgeInteractionsUseCase({
      nudgeReader: await seedInteractions(),
      interactionConfig: { isEnabled: true },
      mutualFriendReader: createFollowReader(),
    });

    // When
    const firstPage = await useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      direction: "received",
      size: 2,
    });
    const secondPage = await useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      direction: "received",
      size: 2,
      cursor: firstPage.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(firstPage.items.map(({ id, isAvailable }) => ({ id, isAvailable }))).toEqual([
      { id: 3, isAvailable: false },
      { id: 2, isAvailable: false },
    ]);
    expect(firstPage.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(secondPage.items.map(({ id, isAvailable }) => ({ id, isAvailable }))).toEqual([
      { id: 1, isAvailable: true },
    ]);
  });

  it("보낸 콕 하나는 받은 친구가 지금 친구인지로 답장 가능 여부를 정한다", async () => {
    // Given
    const mutualFriendReader = createFollowReader();
    const useCase = new GetNudgeInteractionUseCase({
      nudgeReader: await seedInteractions(),
      interactionConfig: { isEnabled: true },
      mutualFriendReader,
    });

    // When
    const before = await useCase.execute({ userId: NUDGE_FIXTURE_SENDER_ID, nudgeId: 1 });
    mutualFriendReader.removeMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
    const after = await useCase.execute({ userId: NUDGE_FIXTURE_SENDER_ID, nudgeId: 1 });

    // Then
    expect({ before: before.isAvailable, after: after.isAvailable }).toEqual({
      before: true,
      after: false,
    });
  });

  it.each([
    {
      name: "기능이 꺼짐",
      isEnabled: false,
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      code: ErrorCode.NUDGE_1111,
    },
    {
      name: "주고받지 않은 콕",
      isEnabled: true,
      userId: NUDGE_FIXTURE_OTHER_USER_ID,
      code: ErrorCode.NUDGE_1105,
    },
  ])("$name이면 $code로 거절한다", async ({ isEnabled, userId, code }) => {
    // Given
    const nudgeReader = await seedInteractions();
    const single = new GetNudgeInteractionUseCase({
      nudgeReader,
      interactionConfig: { isEnabled },
      mutualFriendReader: createFollowReader(),
    });

    // When
    const result = single.execute({ userId, nudgeId: 1 });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
  });
});

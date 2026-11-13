import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { GetSentNudgesUseCase } from "./get-sent-nudges.use-case.js";

describe("GetSentNudgesUseCase — 보낸 콕 목록", () => {
  it("보낸 사람의 콕만 최신순으로 잘라 주고 전체 수를 함께 준다", async () => {
    // Given
    const nudgeReader = new InMemoryNudgeRepository();
    const todoId = await nudgeReader.addTodo(createNudgeTodoSeed());
    for (const index of [0, 1, 2]) {
      await nudgeReader.save(
        createNudgeFixture({
          id: index + 1,
          todoId,
          createdAt: NUDGE_FIXTURE_NOW.add({ minutes: index }),
        }),
      );
    }
    await nudgeReader.save(
      createNudgeFixture({ id: 4, todoId, senderId: NUDGE_FIXTURE_OTHER_USER_ID }),
    );
    const useCase = new GetSentNudgesUseCase({
      countCache: new PassThroughCountCache(),
      nudgeReader,
      logger: new SilentLogger(),
    });

    // When
    const sent = await useCase.execute({ userId: NUDGE_FIXTURE_SENDER_ID, size: 2 });

    // Then
    expect(sent.page.items.map((nudge) => nudge.id)).toEqual([3, 2]);
    expect(sent.page.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(sent.totalCount).toBe(3);
  });
});

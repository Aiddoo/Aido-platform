import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { GetReceivedNudgesUseCase } from "./get-received-nudges.use-case.js";

async function seedReceived(): Promise<InMemoryNudgeRepository> {
  const nudgeReader = new InMemoryNudgeRepository();
  const todoId = await nudgeReader.addTodo(createNudgeTodoSeed());
  for (const index of [0, 1, 2]) {
    await nudgeReader.save(
      createNudgeFixture({
        id: index + 1,
        todoId,
        createdAt: NUDGE_FIXTURE_NOW.add({ minutes: index }),
        readAt: index === 0 ? NUDGE_FIXTURE_NOW : null,
      }),
    );
  }
  return nudgeReader;
}

describe("GetReceivedNudgesUseCase — 받은 콕 목록", () => {
  it("size보다 많으면 마지막 콕 id를 다음 커서로 주고 전체·안 읽은 수를 함께 준다", async () => {
    // Given
    const useCase = new GetReceivedNudgesUseCase({
      countCache: new PassThroughCountCache(),
      nudgeReader: await seedReceived(),
      logger: new SilentLogger(),
    });

    // When
    const firstPage = await useCase.execute({ userId: NUDGE_FIXTURE_RECEIVER_ID, size: 2 });
    const secondPage = await useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      size: 2,
      cursor: firstPage.page.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(firstPage.page.items.map((nudge) => nudge.id)).toEqual([3, 2]);
    expect(firstPage.page.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect({ totalCount: firstPage.totalCount, unreadCount: firstPage.unreadCount }).toEqual({
      totalCount: 3,
      unreadCount: 2,
    });
    expect(secondPage.page.items.map((nudge) => nudge.id)).toEqual([1]);
  });

  it("다른 사람이 받은 콕은 내 목록과 개수에 없다", async () => {
    // Given
    const useCase = new GetReceivedNudgesUseCase({
      countCache: new PassThroughCountCache(),
      nudgeReader: await seedReceived(),
      logger: new SilentLogger(),
    });

    // When
    const received = await useCase.execute({ userId: NUDGE_FIXTURE_OTHER_USER_ID });

    // Then
    expect(received).toEqual({
      page: { items: [], pagination: { nextCursor: null, hasNext: false, size: 20 } },
      totalCount: 0,
      unreadCount: 0,
    });
  });
});

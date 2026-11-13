import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { GetReceivedCheersUseCase } from "./get-received-cheers.use-case.js";

describe("GetReceivedCheersUseCase — 받은 응원 목록", () => {
  it("size보다 많으면 마지막 응원 id를 다음 커서로 주고 전체·안 읽은 수를 함께 준다", async () => {
    // Given
    const cheerReader = new InMemoryCheerRepository(
      [0, 1, 2].map((index) =>
        createCheerFixture({
          id: index + 1,
          createdAt: CHEER_FIXTURE_NOW.add({ minutes: index }),
          readAt: index === 0 ? CHEER_FIXTURE_NOW : null,
        }),
      ),
    );
    const useCase = new GetReceivedCheersUseCase({
      countCache: new PassThroughCountCache(),
      cheerReader,
      logger: new SilentLogger(),
    });

    // When
    const firstPage = await useCase.execute({ userId: CHEER_FIXTURE_RECEIVER_ID, size: 2 });
    const secondPage = await useCase.execute({
      userId: CHEER_FIXTURE_RECEIVER_ID,
      size: 2,
      cursor: firstPage.page.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(firstPage.page.items.map((cheer) => cheer.id)).toEqual([3, 2]);
    expect(firstPage.page.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect({ totalCount: firstPage.totalCount, unreadCount: firstPage.unreadCount }).toEqual({
      totalCount: 3,
      unreadCount: 2,
    });
    expect(secondPage.page.items.map((cheer) => cheer.id)).toEqual([1]);
    expect(secondPage.page.pagination.hasNext).toBe(false);
  });

  it("다른 사람이 받은 응원은 내 목록과 개수에 없다", async () => {
    // Given
    const cheerReader = new InMemoryCheerRepository([createCheerFixture()]);
    const useCase = new GetReceivedCheersUseCase({
      countCache: new PassThroughCountCache(),
      cheerReader,
      logger: new SilentLogger(),
    });

    // When
    const received = await useCase.execute({ userId: CHEER_FIXTURE_OTHER_USER_ID });

    // Then
    expect(received).toEqual({
      page: { items: [], pagination: { nextCursor: null, hasNext: false, size: 20 } },
      totalCount: 0,
      unreadCount: 0,
    });
  });
});

import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryCheerReader } from "#test/doubles/social/in-memory-cheer.reader";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { GetSentCheersUseCase } from "./get-sent-cheers.use-case.js";

describe("GetSentCheersUseCase — 보낸 응원 목록", () => {
  it("보낸 사람의 응원만 최신순으로 잘라 주고 전체 수를 함께 준다", async () => {
    // Given
    const cheerReader = new InMemoryCheerReader(
      new InMemoryCheerRepository([
        createCheerFixture({ id: 1, createdAt: CHEER_FIXTURE_NOW }),
        createCheerFixture({ id: 2, createdAt: CHEER_FIXTURE_NOW.add({ minutes: 1 }) }),
        createCheerFixture({ id: 3, createdAt: CHEER_FIXTURE_NOW.add({ minutes: 2 }) }),
        createCheerFixture({ id: 4, senderId: CHEER_FIXTURE_OTHER_USER_ID }),
      ]),
    );
    const useCase = new GetSentCheersUseCase({
      countCache: new PassThroughCountCache(),
      cheerReader,
      logger: new SilentLogger(),
    });

    // When
    const sent = await useCase.execute({ userId: CHEER_FIXTURE_SENDER_ID, size: 2 });

    // Then
    expect(sent.page.items.map((cheer) => cheer.id)).toEqual([3, 2]);
    expect(sent.page.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(sent.totalCount).toBe(3);
  });
});

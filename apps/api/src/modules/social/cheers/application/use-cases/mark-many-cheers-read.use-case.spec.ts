import { CheerId } from "#api/modules/social/cheers/domain/cheer-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { MarkManyCheersReadUseCase } from "./mark-many-cheers-read.use-case.js";

const READ_AT = CHEER_FIXTURE_NOW.add({ hours: 1 });

describe("MarkManyCheersReadUseCase — 응원 여러 개 읽음", () => {
  it("받은 사람의 안 읽은 응원만 지금 시각으로 바꾸고 바꾼 수를 준다", async () => {
    // Given
    const cheerRepository = new InMemoryCheerRepository([
      createCheerFixture({ id: 1 }),
      createCheerFixture({ id: 2, readAt: CHEER_FIXTURE_NOW }),
      createCheerFixture({ id: 3, receiverId: CHEER_FIXTURE_OTHER_USER_ID }),
    ]);
    const countCache = new PassThroughCountCache();
    const useCase = new MarkManyCheersReadUseCase({
      countCache,
      cheerRepository,
      clock: new FixedClock(READ_AT),
      logger: new SilentLogger(),
    });

    // When
    const count = await useCase.execute({
      userId: CHEER_FIXTURE_RECEIVER_ID,
      cheerIds: [1, 1, 2, 3, 99],
    });
    const repeated = await useCase.execute({ userId: CHEER_FIXTURE_RECEIVER_ID, cheerIds: [1, 2] });

    // Then
    expect({ count, repeated }).toEqual({ count: 1, repeated: 0 });
    const readAts = [];
    for (const id of [1, 2, 3]) {
      readAts.push((await cheerRepository.findById(CheerId.reconstitute(id)))?.readAt ?? null);
    }
    expect(readAts).toEqual([READ_AT, CHEER_FIXTURE_NOW, null]);
    expect(countCache.invalidatedUserIds).toEqual([CHEER_FIXTURE_RECEIVER_ID]);
  });
});

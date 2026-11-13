import { ErrorCode } from "@aido/api/errors";

import { CheerId } from "#api/modules/social/cheers/domain/cheer-id.vo";
import type { Cheer } from "#api/modules/social/cheers/domain/cheer.aggregate";
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

import { MarkCheerReadUseCase } from "./mark-cheer-read.use-case.js";

const READ_AT = CHEER_FIXTURE_NOW.add({ hours: 1 });

// 저장 횟수를 세어 바뀌지 않은 응원은 다시 쓰지 않는지 본다
class CountingCheerRepository extends InMemoryCheerRepository {
  saveCount = 0;

  override async save(cheer: Cheer): Promise<void> {
    this.saveCount += 1;
    await super.save(cheer);
  }
}

describe("MarkCheerReadUseCase — 응원 읽음", () => {
  it.each([
    { name: "없는 응원", userId: CHEER_FIXTURE_RECEIVER_ID, cheerId: 2 },
    { name: "남이 받은 응원", userId: CHEER_FIXTURE_OTHER_USER_ID, cheerId: 1 },
  ])("$name은 CHEER_1205로 거절하고 읽음 상태를 바꾸지 않는다", async ({ userId, cheerId }) => {
    // Given
    const cheerRepository = new InMemoryCheerRepository([createCheerFixture({ id: 1 })]);
    const useCase = new MarkCheerReadUseCase({
      countCache: new PassThroughCountCache(),
      cheerRepository,
      clock: new FixedClock(READ_AT),
      logger: new SilentLogger(),
    });

    // When
    const result = useCase.execute({ userId, cheerId });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.CHEER_1205,
      details: { cheerId },
    });
    expect((await cheerRepository.findById(CheerId.reconstitute(1)))?.readAt).toBeNull();
  });

  it("처음 읽은 시각을 저장하고 다시 읽으면 저장하지 않고 처음 시각을 둔다", async () => {
    // Given
    const cheerRepository = new CountingCheerRepository([createCheerFixture({ id: 1 })]);
    const clock = new FixedClock(READ_AT);
    const useCase = new MarkCheerReadUseCase({
      countCache: new PassThroughCountCache(),
      cheerRepository,
      clock,
      logger: new SilentLogger(),
    });
    const command = { userId: CHEER_FIXTURE_RECEIVER_ID, cheerId: 1 };

    // When
    await useCase.execute(command);
    clock.advanceBy({ seconds: 10 });
    await useCase.execute(command);

    // Then
    expect((await cheerRepository.findById(CheerId.reconstitute(1)))?.readAt).toEqual(READ_AT);
    expect(cheerRepository.saveCount).toBe(1);
  });
});

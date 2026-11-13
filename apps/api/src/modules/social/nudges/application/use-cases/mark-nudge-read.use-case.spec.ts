import { ErrorCode } from "@aido/api/errors";

import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import type { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  createNudgeFixture,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { MarkNudgeReadUseCase } from "./mark-nudge-read.use-case.js";

const READ_AT = NUDGE_FIXTURE_NOW.add({ hours: 1 });
const NUDGE_ID = NudgeId.reconstitute(1);

class CountingNudgeRepository extends InMemoryNudgeRepository {
  saveCount = 0;

  override async save(nudge: Nudge): Promise<void> {
    this.saveCount += 1;
    await super.save(nudge);
  }
}

describe("MarkNudgeReadUseCase — 콕 읽음", () => {
  it.each([
    { name: "없는 콕", userId: NUDGE_FIXTURE_RECEIVER_ID, nudgeId: 2 },
    { name: "남이 받은 콕", userId: NUDGE_FIXTURE_OTHER_USER_ID, nudgeId: 1 },
  ])("$name은 NUDGE_1105로 거절하고 읽음 상태를 바꾸지 않는다", async ({ userId, nudgeId }) => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository([createNudgeFixture()]);
    const useCase = new MarkNudgeReadUseCase({
      countCache: new PassThroughCountCache(),
      unitOfWork: new ImmediateUnitOfWork(),
      nudgeRepository,
      clock: new FixedClock(READ_AT),
      logger: new SilentLogger(),
    });

    // When
    const result = useCase.execute({ userId, nudgeId });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1105,
      details: { nudgeId },
    });
    expect((await nudgeRepository.findById(NUDGE_ID))?.readAt).toBeNull();
  });

  it("처음 읽은 시각을 저장하고 목록 수 캐시를 버리며, 다시 읽으면 저장도 캐시 정리도 하지 않는다", async () => {
    // Given
    const nudgeRepository = new CountingNudgeRepository([createNudgeFixture()]);
    const clock = new FixedClock(READ_AT);
    const countCache = new PassThroughCountCache();
    const useCase = new MarkNudgeReadUseCase({
      countCache,
      unitOfWork: new ImmediateUnitOfWork(),
      nudgeRepository,
      clock,
      logger: new SilentLogger(),
    });
    const command = { userId: NUDGE_FIXTURE_RECEIVER_ID, nudgeId: NUDGE_ID.value };

    // When
    await useCase.execute(command);
    clock.advanceBy({ seconds: 10 });
    await useCase.execute(command);

    // Then
    expect((await nudgeRepository.findById(NUDGE_ID))?.readAt).toEqual(READ_AT);
    expect(nudgeRepository.saveCount).toBe(1);
    expect(countCache.invalidatedUserIds).toEqual([NUDGE_FIXTURE_RECEIVER_ID]);
  });
});

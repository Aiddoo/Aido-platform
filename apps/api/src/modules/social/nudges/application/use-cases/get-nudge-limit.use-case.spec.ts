import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { StubNudgeLimitReader } from "#test/doubles/social/stub-nudge-limit-reader";
import {
  createNudgeFixture,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { GetNudgeLimitUseCase } from "./get-nudge-limit.use-case.js";

describe("GetNudgeLimitUseCase — 콕 일일 한도", () => {
  it.each([
    { name: "FREE", dailyLimit: 3, remaining: 2 },
    { name: "무제한", dailyLimit: null, remaining: null },
  ])("$name은 요청 시간대 하루 사용량과 남은 수를 준다", async ({ dailyLimit, remaining }) => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository(
      ["2026-07-25T14:59:59.999Z", "2026-07-25T15:00:00.000Z", "2026-07-26T15:00:00.000Z"].map(
        (createdAt, index) =>
          createNudgeFixture({ id: index + 1, createdAt: Temporal.Instant.from(createdAt) }),
      ),
    );
    const useCase = new GetNudgeLimitUseCase({
      nudgeRepository,
      limitReader: new StubNudgeLimitReader(dailyLimit),
      clock: new FixedClock(NUDGE_FIXTURE_NOW),
    });

    // When
    const limit = await useCase.execute({
      userId: NUDGE_FIXTURE_SENDER_ID,
      timezone: "Asia/Seoul",
    });

    // Then
    expect(limit).toEqual({ dailyLimit, used: 1, remaining });
  });
});

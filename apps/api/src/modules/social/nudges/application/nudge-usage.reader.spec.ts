import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import {
  createNudgeFixture,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";

import { NudgeUsageReader } from "./nudge-usage.reader.js";

describe("NudgeUsageReader — identity가 읽는 콕 일간 사용량", () => {
  it("LA 시간대 하루에 보낸 수와 다음 현지 자정을 Date로 준다", async () => {
    // Given
    const reader = new NudgeUsageReader({
      nudgeRepository: new InMemoryNudgeRepository([
        createNudgeFixture({ id: 1, createdAt: Temporal.Instant.from("2026-07-25T06:59:59.999Z") }),
        createNudgeFixture({ id: 2, createdAt: Temporal.Instant.from("2026-07-25T07:00:00Z") }),
      ]),
      clock: new FixedClock(NUDGE_FIXTURE_NOW),
    });

    // When
    const usage = await reader.readDailyUsage(
      UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID),
      "America/Los_Angeles",
    );

    // Then
    expect(usage).toEqual({ used: 1, resetsAt: new Date("2026-07-26T07:00:00.000Z") });
  });
});

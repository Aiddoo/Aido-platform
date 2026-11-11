import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { CheerUsageReader } from "./cheer-usage.reader.js";

describe("CheerUsageReader — identity가 읽는 응원 일간 사용량", () => {
  it("요청 시간대 하루에 보낸 수와 다음 현지 자정을 Date로 준다", async () => {
    // Given
    const reader = new CheerUsageReader({
      cheerRepository: new InMemoryCheerRepository([
        createCheerFixture({ id: 1, createdAt: Temporal.Instant.from("2026-07-25T14:59:59.999Z") }),
        createCheerFixture({ id: 2, createdAt: Temporal.Instant.from("2026-07-25T15:00:00Z") }),
      ]),
      clock: new FixedClock(CHEER_FIXTURE_NOW),
    });

    // When
    const usage = await reader.readDailyUsage(
      UserId.reconstitute(CHEER_FIXTURE_SENDER_ID),
      "Asia/Seoul",
    );

    // Then
    expect(usage).toEqual({ used: 1, resetsAt: new Date("2026-07-26T15:00:00.000Z") });
  });
});

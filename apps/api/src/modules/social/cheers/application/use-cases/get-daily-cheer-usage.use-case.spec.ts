import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { GetDailyCheerUsageUseCase } from "./get-daily-cheer-usage.use-case.js";

describe("GetDailyCheerUsageUseCase — identity·access가 읽는 응원 일간 사용량", () => {
  it("요청 시간대 하루에 보낸 수와 다음 현지 자정을 Date로 준다", async () => {
    // Given
    const useCase = new GetDailyCheerUsageUseCase({
      cheerRepository: new InMemoryCheerRepository([
        createCheerFixture({ id: 1, createdAt: Temporal.Instant.from("2026-07-25T14:59:59.999Z") }),
        createCheerFixture({ id: 2, createdAt: Temporal.Instant.from("2026-07-25T15:00:00Z") }),
      ]),
      clock: new FixedClock(CHEER_FIXTURE_NOW),
    });

    // When
    const usage = await useCase.execute({
      userId: CHEER_FIXTURE_SENDER_ID,
      timezone: "Asia/Seoul",
    });

    // Then
    expect(usage).toEqual({ used: 1, resetsAt: new Date("2026-07-26T15:00:00.000Z") });
  });
});

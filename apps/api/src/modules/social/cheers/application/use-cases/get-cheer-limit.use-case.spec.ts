import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import { StubCheerLimitReader } from "#test/doubles/social/stub-cheer-limit-reader";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { GetCheerLimitUseCase } from "./get-cheer-limit.use-case.js";

describe("GetCheerLimitUseCase — 응원 일일 한도", () => {
  it.each([
    { name: "FREE", dailyLimit: 3, remaining: 2 },
    { name: "무제한", dailyLimit: null, remaining: null },
  ])(
    "$name은 요청 시간대 하루의 시작을 넣고 끝을 뺀 사용량과 남은 수를 준다",
    async ({ dailyLimit, remaining }) => {
      // Given
      const cheerRepository = new InMemoryCheerRepository(
        ["2026-07-25T14:59:59.999Z", "2026-07-25T15:00:00.000Z", "2026-07-26T15:00:00.000Z"].map(
          (createdAt, index) =>
            createCheerFixture({ id: index + 1, createdAt: Temporal.Instant.from(createdAt) }),
        ),
      );
      await cheerRepository.save(
        createCheerFixture({ id: 9, senderId: CHEER_FIXTURE_OTHER_USER_ID }),
      );
      const useCase = new GetCheerLimitUseCase({
        cheerRepository,
        limitReader: new StubCheerLimitReader(dailyLimit),
        clock: new FixedClock(CHEER_FIXTURE_NOW),
      });

      // When
      const limit = await useCase.execute({
        userId: CHEER_FIXTURE_SENDER_ID,
        timezone: "Asia/Seoul",
      });

      // Then
      expect(limit).toEqual({ dailyLimit, used: 1, remaining });
    },
  );
});

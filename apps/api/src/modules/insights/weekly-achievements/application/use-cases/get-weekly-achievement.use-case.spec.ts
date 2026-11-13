import { ErrorCode } from "@aido/api/errors";

import { InMemoryWeeklyAchievementRepository } from "#test/doubles/insights/in-memory-weekly-achievement.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

import { GetWeeklyAchievementUseCase } from "./get-weekly-achievement.use-case.js";

const OWNER_CALENDAR = {
  ownerTimezoneReader: { read: async () => "Asia/Seoul" },
  clock: new FixedClock(Temporal.Instant.from("2026-11-12T00:00:00Z")),
};

describe("GetWeeklyAchievementUseCase", () => {
  it("요청한 사용자의 그 주 기록을 돌려준다", async () => {
    // Given
    const achievement = createWeeklyAchievementFixture({ year: 2026, week: 10 });
    const useCase = new GetWeeklyAchievementUseCase({
      weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([achievement]),
      ...OWNER_CALENDAR,
    });

    // When
    const { achievement: found } = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      week: 10,
    });

    // Then
    expect(found.toPrimitives()).toEqual(achievement.toPrimitives());
  });

  it("라벨의 올해는 서버 시각을 사용자 저장 시간대의 달력 날짜로 읽은 것이다", async () => {
    // Given
    // UTC로는 아직 2026-12-31이지만 서울은 2027-01-01 00:30이다
    const useCase = new GetWeeklyAchievementUseCase({
      weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([
        createWeeklyAchievementFixture({ year: 2026, week: 10 }),
      ]),
      ownerTimezoneReader: { read: async () => "Asia/Seoul" },
      clock: new FixedClock(Temporal.Instant.from("2026-12-31T15:30:00Z")),
    });

    // When
    const { localToday } = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      week: 10,
    });

    // Then
    expect(localToday.toString()).toBe("2027-01-01");
  });

  it("다른 사용자의 기록으로 요청자의 빈 주를 채우지 않고 ACHIEVEMENT_1801로 거절한다", async () => {
    // Given
    const useCase = new GetWeeklyAchievementUseCase({
      weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([
        createWeeklyAchievementFixture({ userId: WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID }),
      ]),
      ...OWNER_CALENDAR,
    });

    // When
    const execution = useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      week: 10,
    });

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: ErrorCode.ACHIEVEMENT_1801,
      details: { year: 2026, week: 10 },
    });
  });
});

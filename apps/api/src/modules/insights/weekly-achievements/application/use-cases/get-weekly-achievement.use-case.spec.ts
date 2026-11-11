import { ErrorCode } from "@aido/api/errors";

import { InMemoryWeeklyAchievementRepository } from "#test/doubles/insights/in-memory-weekly-achievement.repository";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

import { GetWeeklyAchievementUseCase } from "./get-weekly-achievement.use-case.js";

describe("GetWeeklyAchievementUseCase", () => {
  it("요청한 사용자의 그 주 기록을 돌려준다", async () => {
    // Given
    const achievement = createWeeklyAchievementFixture({ year: 2026, week: 10 });
    const useCase = new GetWeeklyAchievementUseCase({
      weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([achievement]),
    });

    // When
    const found = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      week: 10,
    });

    // Then
    expect(found.toPrimitives()).toEqual(achievement.toPrimitives());
  });

  it("다른 사용자의 기록으로 요청자의 빈 주를 채우지 않고 ACHIEVEMENT_1801로 거절한다", async () => {
    // Given
    const useCase = new GetWeeklyAchievementUseCase({
      weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([
        createWeeklyAchievementFixture({ userId: WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID }),
      ]),
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

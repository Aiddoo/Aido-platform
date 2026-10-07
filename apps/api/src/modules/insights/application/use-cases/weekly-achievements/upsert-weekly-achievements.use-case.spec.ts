import { ErrorCode } from "@aido/api/errors";

import {
  createInsightsFixture,
  createWeeklyAchievementWriteFixture,
  INSIGHTS_TIME,
} from "#test/fixtures/insights.fixture";

import { UpsertWeeklyAchievements } from "./upsert-weekly-achievements.use-case.js";

describe("UpsertWeeklyAchievements", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("빈 배치는 저장 요청을 만들지 않는다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const save = vi.spyOn(fixture.weeklyRepository, "upsertMany");
    const useCase = new UpsertWeeklyAchievements({ repository: fixture.weeklyRepository });
    // When
    await useCase.execute({ records: [] });
    // Then
    expect(save).not.toHaveBeenCalled();
    expect(fixture.weeklyRepository.rows.size).toBe(0);
  });

  it("여러 사용자·주차를 저장하고 같은 주차의 재집계는 기존 기록을 갱신한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const first = createWeeklyAchievementWriteFixture();
    const second = createWeeklyAchievementWriteFixture({ userId: fixture.viewerId, week: 11 });
    const useCase = new UpsertWeeklyAchievements({ repository: fixture.weeklyRepository });
    // When
    await useCase.execute({ records: [first, second] });
    const before = await fixture.weeklyRepository.findByYearAndWeek(
      first.userId,
      first.year,
      first.week,
    );
    await useCase.execute({ records: [{ ...first, completedTodos: 5 }] });
    const after = await fixture.weeklyRepository.findByYearAndWeek(
      first.userId,
      first.year,
      first.week,
    );
    // Then
    expect(fixture.weeklyRepository.rows.size).toBe(2);
    expect(after).toEqual({
      id: before?.id,
      year: first.year,
      week: first.week,
      totalTodos: 5,
      completedTodos: 5,
      achievedAt: first.achievedAt,
    });
    expect(
      await fixture.weeklyRepository.findByYearAndWeek(second.userId, second.year, second.week),
    ).toMatchObject({ completedTodos: 3, week: 11 });
  });

  it("배치 뒤쪽의 완료 수가 잘못되어도 앞쪽 기록을 저장 요청하지 않는다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const save = vi.spyOn(fixture.weeklyRepository, "upsertMany");
    const records = [
      createWeeklyAchievementWriteFixture(),
      createWeeklyAchievementWriteFixture({ week: 11, totalTodos: 2, completedTodos: 5 }),
    ];
    const useCase = new UpsertWeeklyAchievements({ repository: fixture.weeklyRepository });
    // When, Then
    await expect(useCase.execute({ records })).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
    });
    expect(save).not.toHaveBeenCalled();
    expect(fixture.weeklyRepository.rows.size).toBe(0);
  });
});

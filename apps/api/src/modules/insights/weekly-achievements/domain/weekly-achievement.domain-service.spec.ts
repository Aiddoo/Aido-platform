import { createWeeklyAchievementFixture } from "#test/fixtures/insights/weekly-achievement.fixture";

import { IsoWeek } from "./iso-week.vo.js";
import {
  computeWeeklyStreak,
  summarizeWeeklyAchievements,
} from "./weekly-achievement.domain-service.js";

function weeks(...pairs: ReadonlyArray<readonly [number, number]>): IsoWeek[] {
  return pairs.map(([year, week]) => IsoWeek.create(year, week));
}

describe("주간 성취 요약", () => {
  it.each([
    { name: "기록이 없으면 0", year: 2026, recordedWeeks: weeks(), current: 0, best: 0 },
    { name: "한 주면 1", year: 2026, recordedWeeks: weeks([2026, 5]), current: 1, best: 1 },
    {
      name: "가운데 빈 주에서 끊긴다",
      year: 2026,
      recordedWeeks: weeks([2026, 5], [2026, 6], [2026, 8], [2026, 9], [2026, 10]),
      current: 3,
      best: 3,
    },
    {
      name: "52주 해의 연말에서 다음 해 1주로 잇는다",
      year: 2026,
      recordedWeeks: weeks([2025, 51], [2025, 52], [2026, 1], [2026, 2]),
      current: 4,
      best: 4,
    },
    {
      name: "53주 해의 53주에서 다음 해 1주로 잇는다",
      year: 2021,
      recordedWeeks: weeks([2020, 52], [2020, 53], [2021, 1]),
      current: 3,
      best: 3,
    },
    {
      name: "최고 기록과 현재 연속이 다를 수 있다",
      year: 2026,
      recordedWeeks: weeks([2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 8], [2026, 9]),
      current: 2,
      best: 4,
    },
    {
      name: "그해 기록이 없으면 앞 해 연속이 있어도 0",
      year: 2027,
      recordedWeeks: weeks([2026, 52], [2026, 53]),
      current: 0,
      best: 0,
    },
    {
      name: "앞 해에서 이어 온 연속은 최고 기록에도 끝까지 센다",
      year: 2027,
      recordedWeeks: weeks([2026, 50], [2026, 51], [2026, 52], [2026, 53], [2027, 1], [2027, 5]),
      current: 1,
      best: 5,
    },
    {
      name: "앞 해 안에서 끝난 더 긴 연속은 그해 최고 기록이 아니다",
      year: 2027,
      recordedWeeks: weeks([2026, 1], [2026, 2], [2026, 3], [2026, 4], [2027, 2], [2027, 3]),
      current: 2,
      best: 2,
    },
    {
      name: "지난해 요약은 다음 해로 이어진 주를 세지 않는다",
      year: 2026,
      recordedWeeks: weeks([2026, 52], [2026, 53], [2027, 1], [2027, 2]),
      current: 2,
      best: 2,
    },
  ])("연속 주: $name", ({ year, recordedWeeks, current, best }) => {
    // When
    const streak = computeWeeklyStreak({ year, weeks: recordedWeeks });

    // Then
    expect(streak).toEqual({ currentStreak: current, bestStreak: best });
  });

  it("완벽한 주 수·반올림 평균 완료율·연속 주를 순서와 상관없이 계산한다", () => {
    // Given
    const achievements = [
      createWeeklyAchievementFixture({ id: 3, week: 3, totalTodos: 10, completedTodos: 10 }),
      createWeeklyAchievementFixture({ id: 1, week: 1, totalTodos: 10, completedTodos: 10 }),
      createWeeklyAchievementFixture({ id: 2, week: 2, totalTodos: 10, completedTodos: 8 }),
    ];

    // When
    const summary = summarizeWeeklyAchievements({ year: 2026, achievements });

    // Then
    // (100 + 80 + 100) / 3 = 93.3 → 93
    expect(summary).toEqual({
      totalWeeks: 3,
      perfectWeeks: 2,
      currentStreak: 3,
      bestStreak: 3,
      averageRate: 93,
    });
  });

  it("주 수·완벽한 주·평균 완료율은 그해 기록만 세고 연속 주만 앞 해에서 잇는다", () => {
    // Given
    const achievements = [
      createWeeklyAchievementFixture({ id: 1, year: 2026, week: 52, completedTodos: 10 }),
      createWeeklyAchievementFixture({ id: 2, year: 2026, week: 53, completedTodos: 10 }),
      createWeeklyAchievementFixture({ id: 3, year: 2027, week: 1, completedTodos: 5 }),
    ];

    // When
    const summary = summarizeWeeklyAchievements({ year: 2027, achievements });

    // Then
    expect(summary).toEqual({
      totalWeeks: 1,
      perfectWeeks: 0,
      currentStreak: 3,
      bestStreak: 3,
      averageRate: 50,
    });
  });

  it("기록이 없으면 모든 값이 0이다", () => {
    // When
    const summary = summarizeWeeklyAchievements({ year: 2026, achievements: [] });

    // Then
    expect(summary).toEqual({
      totalWeeks: 0,
      perfectWeeks: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageRate: 0,
    });
  });
});

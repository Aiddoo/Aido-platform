import { WeeklyAchievement } from "../../../domain/weekly-achievement.aggregate.js";
import { toWeeklyAchievementResponse } from "./weekly-achievement-response.mapper.js";

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const WEEKS = Array.from({ length: 53 }, (_, index) => index + 1);

describe("주간 성취 응답의 주차 라벨·기간", () => {
  it("2024~2030년 1~53주의 ko·en 라벨과 월~일 기간이 출시 응답과 바이트 단위로 같다", () => {
    // Given
    const achievements = YEARS.flatMap((year) =>
      WEEKS.map((week) =>
        WeeklyAchievement.reconstitute({
          id: 1,
          userId: "user-1",
          year,
          week,
          totalTodos: 0,
          completedTodos: 0,
          achievedAt: Temporal.Instant.from("2026-11-12T00:00:00Z"),
        }),
      ),
    );

    // When
    const rendered = achievements.map((achievement) => {
      // 그 주를 그 주의 목요일에 본다. 올해 주는 연도 없이 출시 응답과 같은 글자이고, 다른 해 주의 연도는 week-of-month 표가 고정한다
      const localToday = achievement.isoWeek.startDate.add({ days: 3 });
      const ko = toWeeklyAchievementResponse(achievement, "ko", localToday);
      const en = toWeeklyAchievementResponse(achievement, "en", localToday);
      const week = String(ko.week).padStart(2, "0");
      return `${ko.year}-W${week} ${ko.dateRange.startDate}~${ko.dateRange.endDate} ${ko.weekLabel} | ${en.weekLabel}`;
    });

    // Then
    expect(rendered).toMatchSnapshot();
  });
});

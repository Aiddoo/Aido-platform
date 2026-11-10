import { computeWeekLabel } from "../../../application/read-models/weekly-achievement.read-model.js";
import { computeDateRange } from "../../../domain/weekly-achievement.domain-service.js";

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const WEEKS = Array.from({ length: 53 }, (_, index) => index + 1);

describe("주간 성취 응답의 주차 라벨·기간", () => {
  it("2024~2030년 1~53주의 ko·en 라벨과 월~일 기간이 출시 응답과 바이트 단위로 같다", () => {
    // Given
    const weeks = YEARS.flatMap((year) => WEEKS.map((week) => ({ year, week })));

    // When
    const rendered = weeks.map(({ year, week }) => {
      const { startDate, endDate } = computeDateRange(year, week);
      const ko = computeWeekLabel(year, week, "ko");
      const en = computeWeekLabel(year, week, "en");
      return `${year}-W${String(week).padStart(2, "0")} ${startDate}~${endDate} ${ko} | ${en}`;
    });

    // Then
    expect(rendered).toMatchSnapshot();
  });
});

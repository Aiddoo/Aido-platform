import { IsoWeek } from "../../../domain/iso-week.vo.js";
import { formatWeekLabel } from "./weekly-achievement-response.mapper.js";

const YEARS = [2_024, 2_025, 2_026, 2_027, 2_028, 2_029, 2_030];
const WEEKS = Array.from({ length: 53 }, (_, index) => index + 1);

describe("주간 성취 응답의 주차 라벨·기간", () => {
  it("2024~2030년 1~53주의 ko·en 라벨과 월~일 기간이 출시 응답과 바이트 단위로 같다", () => {
    // Given
    const weeks = YEARS.flatMap((year) => WEEKS.map((week) => IsoWeek.create(year, week)));

    // When
    const rendered = weeks.map((isoWeek) => {
      const ko = formatWeekLabel(isoWeek, "ko");
      const en = formatWeekLabel(isoWeek, "en");
      const week = String(isoWeek.week).padStart(2, "0");
      return `${isoWeek.year}-W${week} ${isoWeek.startDate.toString()}~${isoWeek.endDate.toString()} ${ko} | ${en}`;
    });

    // Then
    expect(rendered).toMatchSnapshot();
  });
});

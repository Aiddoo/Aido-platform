import type { WeeklyAchievementRow } from "../../../domain/records/weekly-achievements/weekly-achievement.record.js";
import { computeWeekLabel, toWeeklyAchievementView } from "./weekly-achievement.read-model.js";

function row(overrides?: Partial<WeeklyAchievementRow>): WeeklyAchievementRow {
  return {
    id: 1,
    year: 2026,
    week: 1,
    totalTodos: 10,
    completedTodos: 8,
    achievedAt: new Date("2026-01-05T11:00:00.000Z"),
    ...overrides,
  };
}

describe("주간 달성 응답 표현", () => {
  describe("computeWeekLabel — en 로케일", () => {
    it("en 라벨은 'Week N of MMM' 형식이다 (모바일 캘린더 표기와 일치)", () => {
      expect(computeWeekLabel(2026, 10, "en")).toBe("Week 1 of Mar");
    });

    it("locale 생략 시 한국어 라벨을 유지한다 (하위 호환)", () => {
      expect(computeWeekLabel(2026, 10)).toBe("3월 1주차");
    });
  });

  describe("computeWeekLabel", () => {
    it("일반 주차의 라벨을 생성한다", () => {
      const label = computeWeekLabel(2026, 10);
      expect(label).toMatch(/^\d+월 \d+주차$/);
      expect(label).toContain("3월");
    });

    it("연초 주차의 라벨을 생성한다", () => {
      expect(computeWeekLabel(2026, 1)).toMatch(/^\d+월 \d+주차$/);
    });

    it("연말 주차의 라벨을 생성한다", () => {
      expect(computeWeekLabel(2025, 52)).toMatch(/^\d+월 \d+주차$/);
    });
  });

  describe("toWeeklyAchievementView", () => {
    it("레코드를 응답 뷰로 변환한다", () => {
      const view = toWeeklyAchievementView(
        row({
          id: 42,
          year: 2026,
          week: 10,
          totalTodos: 15,
          completedTodos: 14,
          achievedAt: new Date("2026-03-08T11:00:00.000Z"),
        }),
      );
      expect(view.id).toBe(42);
      expect(view.year).toBe(2026);
      expect(view.week).toBe(10);
      expect(view.weekLabel).toMatch(/\d+월 \d+주차/);
      expect(view.dateRange.startDate).toBe("2026-03-02");
      expect(view.dateRange.endDate).toBe("2026-03-08");
      expect(view.totalTodos).toBe(15);
      expect(view.completedTodos).toBe(14);
      expect(view.completionRate).toBe(93);
      expect(view.achievedAt).toBe("2026-03-08T11:00:00.000Z");
    });

    it("totalTodos가 0이면 completionRate는 0이다", () => {
      const view = toWeeklyAchievementView(row({ totalTodos: 0, completedTodos: 0 }));
      expect(view.completionRate).toBe(0);
    });
  });
});

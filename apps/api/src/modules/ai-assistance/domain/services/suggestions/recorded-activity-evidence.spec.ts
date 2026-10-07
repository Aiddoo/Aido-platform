import type { TodoSummaryForAnalysis } from "../../types/suggestions/ai-suggestion.types.js";
import { collectRecordedActivities, selectRecordedDays } from "./recorded-activity-evidence.js";

const todo = (startDate: string, completed = true): TodoSummaryForAnalysis => ({
  title: "책 읽기 10분",
  startDate,
  completed,
  scheduledTime: null,
  categoryId: 1,
  categoryName: "독서",
});

describe("recorded activity evidence", () => {
  it("월요일 DATE 기록 세 개와 시각을 실제 등록/완료 근거로 구분한다", () => {
    const records = [
      todo("2026-09-21"),
      todo("2026-09-28", false),
      { ...todo("2026-10-05"), scheduledTime: "19:30" },
    ];
    const [evidence] = collectRecordedActivities(records);
    expect(evidence).toEqual({
      title: "책 읽기 10분",
      occurrences: 3,
      completedOccurrences: 2,
      days: [{ day: "MON", total: 3, completed: 2 }],
      recordedTimes: ["19:30"],
    });
    expect(selectRecordedDays(evidence!)).toEqual(["MON"]);
  });
  it("반복 등록과 실제 완료가 있는 요일을 단발성 완료보다 우선한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-21"),
      todo("2026-09-28", false),
      todo("2026-09-23"),
    ]);
    expect(selectRecordedDays(evidence!)).toEqual(["MON"]);
  });
  it("요일 반복이 없으면 완료 수, 기록 수, ISO 요일 순의 최빈 한 요일을 제안한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-23"),
      todo("2026-09-21"),
      todo("2026-09-22", false),
    ]);
    expect(selectRecordedDays(evidence!)).toEqual(["MON"]);
  });
  it("완료가 없으면 성공을 만들지 않고 가장 많이 등록한 요일만 선택한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-23", false),
      todo("2026-09-30", false),
      todo("2026-09-21", false),
    ]);
    expect(evidence?.completedOccurrences).toBe(0);
    expect(selectRecordedDays(evidence!)).toEqual(["WED"]);
  });
});

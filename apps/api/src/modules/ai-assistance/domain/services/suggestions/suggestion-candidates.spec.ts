import type { TodoSummaryForAnalysis } from "../../types/suggestions/ai-suggestion.types.js";
import {
  buildSuggestionCandidates,
  isReasonGrounded,
  MAX_SUGGESTION_CANDIDATES,
  resolveSuggestionPicks,
  suggestionConfidence,
} from "./suggestion-candidates.js";

function todo(
  title: string,
  startDate: string,
  overrides: Partial<TodoSummaryForAnalysis> = {},
): TodoSummaryForAnalysis {
  return {
    title,
    startDate,
    scheduledTime: null,
    categoryId: 1,
    completed: true,
    categoryName: "운동",
    ...overrides,
  };
}

// 2026-10-05·12·19 월요일, 10-08·15 목요일
const runs = [
  todo("러닝 5km", "2026-10-05", { scheduledTime: "07:00" }),
  todo("러닝 5km", "2026-10-12", { scheduledTime: "07:00" }),
  todo("러닝 5km", "2026-10-19", { scheduledTime: "08:00" }),
  todo("러닝 5km", "2026-10-08", { completed: false }),
];
const groceries = [todo("장보기", "2026-10-10", { categoryName: "생활" })];

describe("buildSuggestionCandidates", () => {
  it("많이 기록한 활동부터 id를 붙이고 2회 이상 반복된 시각만 기록 시각으로 둔다", () => {
    // Given / When
    const candidates = buildSuggestionCandidates([...groceries, ...runs]);
    // Then
    expect(candidates).toEqual([
      {
        id: "a1",
        title: "러닝 5km",
        occurrences: 4,
        completed: 3,
        days: [
          { day: "MON", total: 3, completed: 3 },
          { day: "THU", total: 1, completed: 0 },
        ],
        recordedTime: "07:00",
        categoryName: "운동",
      },
      expect.objectContaining({ id: "a2", title: "장보기", recordedTime: null }),
    ]);
  });

  it("후보는 최대 30개다", () => {
    // Given
    const many = Array.from({ length: 40 }, (_, index) => todo(`활동 ${index}`, "2026-10-05"));
    // When / Then
    expect(buildSuggestionCandidates(many)).toHaveLength(MAX_SUGGESTION_CANDIDATES);
  });
});

describe("resolveSuggestionPicks", () => {
  const candidates = buildSuggestionCandidates([...runs, ...groceries]);

  it("없는 id·중복 id·이력 활동은 버리고 요일은 기록 요일과의 교집합만 남긴다", () => {
    // Given
    const picks = [
      { candidateId: "zz", daysOfWeek: ["MON" as const], useRecordedTime: false, reason: "" },
      {
        candidateId: "a1",
        daysOfWeek: ["MON" as const, "SUN" as const],
        useRecordedTime: true,
        reason: "r",
      },
      { candidateId: "a1", daysOfWeek: ["THU" as const], useRecordedTime: false, reason: "dup" },
      { candidateId: "a2", daysOfWeek: ["SAT" as const], useRecordedTime: false, reason: "x" },
    ];
    // When
    const resolved = resolveSuggestionPicks(picks, candidates, {
      mode: "PATTERN",
      excludedTitles: [],
    });
    // Then - 장보기는 1회 기록이라 PATTERN에서 제외된다
    expect(resolved).toEqual([
      expect.objectContaining({
        daysOfWeek: ["MON"],
        scheduledTime: "07:00",
        modelReason: "r",
      }),
    ]);
  });

  it("교집합이 비면 기록된 요일로 정하고, 기록 시각이 없으면 시각을 쓰지 않는다", () => {
    // Given
    const picks = [
      { candidateId: "a2", daysOfWeek: ["MON" as const], useRecordedTime: true, reason: "" },
    ];
    // When
    const [starter] = resolveSuggestionPicks(picks, candidates, {
      mode: "STARTER",
      excludedTitles: [],
    });
    // Then - 2026-10-10은 토요일이다
    expect(starter).toMatchObject({ daysOfWeek: ["SAT"], scheduledTime: null, confidence: 0.55 });
  });

  it("거절·수락 이력의 활동은 고르지 않는다", () => {
    // Given
    const picks = [
      { candidateId: "a1", daysOfWeek: ["MON" as const], useRecordedTime: false, reason: "" },
    ];
    // When
    const resolved = resolveSuggestionPicks(picks, candidates, {
      mode: "PATTERN",
      excludedTitles: ["러닝 5km"],
    });
    // Then
    expect(resolved).toEqual([]);
  });
});

describe("suggestionConfidence·isReasonGrounded", () => {
  const [run] = buildSuggestionCandidates(runs);

  it("3회 이상·완료율 0.6 이상이면 0.8 + 0.15×완료율이다", () => {
    // Given / When / Then
    if (run == null) throw new Error("candidate missing");
    expect(suggestionConfidence(run, "PATTERN")).toBe(0.91);
    expect(suggestionConfidence({ ...run, occurrences: 2, completed: 2 }, "PATTERN")).toBe(0.65);
  });

  it("사유의 숫자는 후보 근거에 있는 값만 허용한다", () => {
    // Given / When / Then
    if (run == null) throw new Error("candidate missing");
    expect(isReasonGrounded("월요일에 러닝을 3번 모두 끝냈어요.", run)).toBe(true);
    expect(isReasonGrounded("7시에 4번 기록했어요.", run)).toBe(true);
    expect(isReasonGrounded("10번 연속 성공했어요.", run)).toBe(false);
  });
});

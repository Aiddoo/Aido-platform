import {
  buildSuggestionCandidates,
  MAX_SUGGESTION_CANDIDATES,
  resolveSuggestionPicks,
  suggestionConfidence,
} from "./suggestion-candidates.domain-service.js";
import type { TodoSummaryForAnalysis } from "./suggestion.constants.js";

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
  it("많이 기록한 활동부터 id를 붙이고 완료율과 2회 이상 반복된 시각을 넣는다", () => {
    // When
    const candidates = buildSuggestionCandidates([...groceries, ...runs], "STARTER");
    // Then
    expect(candidates).toEqual([
      {
        id: "a1",
        title: "러닝 5km",
        occurrences: 4,
        completed: 3,
        completionRate: 75,
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

  it("PATTERN 모드는 한 번만 기록한 활동을 후보에 넣지 않는다", () => {
    // When
    const candidates = buildSuggestionCandidates([...groceries, ...runs], "PATTERN");
    // Then
    expect(candidates.map((candidate) => candidate.title)).toEqual(["러닝 5km"]);
  });

  it("후보는 최대 30개다", () => {
    // Given
    const many = Array.from({ length: 40 }, (_, index) => todo(`활동 ${index}`, "2026-10-05"));
    // When / Then
    expect(buildSuggestionCandidates(many, "STARTER")).toHaveLength(MAX_SUGGESTION_CANDIDATES);
  });
});

describe("resolveSuggestionPicks", () => {
  const candidates = buildSuggestionCandidates([...runs, ...groceries], "STARTER");

  it("없는 id·중복 id·이력 활동은 버리고 요일은 기록 요일과의 교집합만 남긴다", () => {
    // Given
    const picks = [
      { candidateId: "zz", daysOfWeek: ["MON" as const], useRecordedTime: false },
      { candidateId: "a1", daysOfWeek: ["MON" as const, "SUN" as const], useRecordedTime: true },
      { candidateId: "a1", daysOfWeek: ["THU" as const], useRecordedTime: false },
    ];
    // When
    const resolved = resolveSuggestionPicks(picks, candidates, {
      mode: "PATTERN",
      excludedTitles: [],
    });
    // Then
    expect(resolved).toEqual([
      expect.objectContaining({ daysOfWeek: ["MON"], scheduledTime: "07:00" }),
    ]);
  });

  it("교집합이 비면 기록된 요일로 정하고, 기록 시각이 없으면 시각을 쓰지 않는다", () => {
    // Given
    const picks = [{ candidateId: "a2", daysOfWeek: ["MON" as const], useRecordedTime: true }];
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
    const picks = [{ candidateId: "a1", daysOfWeek: ["MON" as const], useRecordedTime: false }];
    // When
    const resolved = resolveSuggestionPicks(picks, candidates, {
      mode: "PATTERN",
      excludedTitles: ["러닝 5km"],
    });
    // Then
    expect(resolved).toEqual([]);
  });
});

describe("suggestionConfidence", () => {
  const [run] = buildSuggestionCandidates(runs, "PATTERN");

  it("3회 이상·완료율 0.6 이상이면 0.8 + 0.15×완료율이다", () => {
    // Then
    if (run == null) {
      throw new Error("candidate missing");
    }
    expect(suggestionConfidence(run, "PATTERN")).toBe(0.91);
    expect(suggestionConfidence({ ...run, occurrences: 2, completed: 2 }, "PATTERN")).toBe(0.65);
  });
});

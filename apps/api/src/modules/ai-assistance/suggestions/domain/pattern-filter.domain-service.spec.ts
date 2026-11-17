import { dedupeByTitlePrefixAndDays } from "./pattern-filter.domain-service.js";
import type { DetectedPattern } from "./suggestion.constants.js";

const makePattern = (overrides: Partial<DetectedPattern> = {}): DetectedPattern => ({
  title: "테스트 제안",
  daysOfWeek: ["MON"],
  scheduledTime: null,
  confidence: 0.8,
  reason: "기본 이유",
  matchedTitles: ["매칭1", "매칭2"],
  recordedCount: 2,
  completedCount: 2,
  ...overrides,
});

describe("dedupeByTitlePrefixAndDays", () => {
  it("제목 앞 두 어절과 요일이 같으면 신뢰도가 가장 높은 제안 하나만 남긴다", () => {
    // Given
    const patterns = [
      makePattern({ title: "오전 자기계발 30분", daysOfWeek: ["MON", "WED"], confidence: 0.75 }),
      makePattern({ title: "오전 자기계발 1시간", daysOfWeek: ["MON", "WED"], confidence: 0.85 }),
      makePattern({ title: "저녁 운동 20분", daysOfWeek: ["TUE"], confidence: 0.7 }),
    ];
    // When
    const result = dedupeByTitlePrefixAndDays(patterns);
    // Then
    expect(result.map((pattern) => pattern.title)).toEqual([
      "오전 자기계발 1시간",
      "저녁 운동 20분",
    ]);
  });

  it("요일이 다르면 같은 제목이어도 따로 남긴다", () => {
    // Given
    const patterns = [
      makePattern({ title: "산책 가기", daysOfWeek: ["MON"] }),
      makePattern({ title: "산책 가기", daysOfWeek: ["SAT", "SUN"] }),
    ];
    // When
    const result = dedupeByTitlePrefixAndDays(patterns);
    // Then
    expect(result).toHaveLength(2);
  });
});

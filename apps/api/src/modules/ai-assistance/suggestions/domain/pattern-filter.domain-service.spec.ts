import { dedupeByTitlePrefixAndDays, isWeatherRelated } from "./pattern-filter.domain-service.js";
import type { DetectedPattern } from "./suggestion.constants.js";

const makePattern = (overrides: Partial<DetectedPattern> = {}): DetectedPattern => ({
  title: "테스트 제안",
  daysOfWeek: ["MON"],
  scheduledTime: null,
  confidence: 0.8,
  reason: "기본 이유",
  matchedTitles: ["매칭1", "매칭2"],
  ...overrides,
});

describe("isWeatherRelated", () => {
  it.each([
    "비 오는 날 실내 활동",
    "비가 오는 날이니 실내에서 운동",
    "비 때문에 산책을 줄여요",
    "Rain is expected today",
    "RAIN calls for Indoor exercise",
  ])("날씨를 사실로 말하는 '%s'는 날씨 사유다", (reason) => {
    // Given
    const input = reason;
    // When
    const result = isWeatherRelated(input);
    // Then
    expect(result).toBe(true);
  });

  it.each([
    "자기계발 카테고리 완료율이 높아요",
    "준비 운동을 추천해요",
    "Train for the week",
    "실내 운동을 가볍게 해봐요",
    "Try indoor exercise",
  ])("날씨 사실이 아닌 '%s'는 날씨 사유가 아니다", (reason) => {
    // Given
    const input = reason;
    // When
    const result = isWeatherRelated(input);
    // Then
    expect(result).toBe(false);
  });
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

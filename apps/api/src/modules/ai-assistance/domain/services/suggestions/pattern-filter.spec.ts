/**
 * pattern-filter.util — 순수 함수 유닛 테스트
 */

import type {
  DetectedPattern,
  PatternEvidenceContext,
} from "../../types/suggestions/ai-suggestion.types.js";
import {
  applyTypeCap,
  dedupeByTitlePrefixAndDays,
  filterWeakPatterns,
  groundPatternCandidates,
  isWeatherRelated,
  normalizeStarterSuggestions,
} from "./pattern-filter.js";
type Pattern = DetectedPattern;

const makePattern = (overrides: Partial<Pattern> = {}): Pattern => ({
  title: "테스트 제안",
  daysOfWeek: ["MON"],
  scheduledTime: null,
  confidence: 0.8,
  reason: "기본 이유",
  matchedTitles: ["매칭1", "매칭2"],
  ...overrides,
});

const baseContext: PatternEvidenceContext = {
  todos: ["운동", "운동", "공부"].map((title) => ({
    title,
    startDate: "2026-03-02",
    scheduledTime: null,
    categoryId: 1,
    completed: true,
    categoryName: "생활",
  })),
  weather: null,
};

describe("pattern-filter.util — AI 제안 순수 함수", () => {
  describe("isWeatherRelated", () => {
    it("reason 에 날씨 키워드 포함 시 true", () => {
      // Given
      const reason = "비 오는 날 실내 활동";

      // When
      const result = isWeatherRelated(reason);

      // Then
      expect(result).toBe(true);
    });

    it("날씨 무관 reason 에는 false", () => {
      // Given
      const reason = "자기계발 카테고리 완료율이 높아요";

      // When
      const result = isWeatherRelated(reason);

      // Then
      expect(result).toBe(false);
    });
  });

  describe("filterWeakPatterns", () => {
    it("matchedTitles 가 빈 시즌/밸런스 제안은 통과", () => {
      // Given
      const patterns = [makePattern({ matchedTitles: [] })];

      // When
      const result = filterWeakPatterns(patterns, baseContext);

      // Then
      expect(result).toHaveLength(1);
    });

    it("날씨 관련 reason + weather 컨텍스트 없음 → 제거", () => {
      // Given
      const patterns = [
        makePattern({
          reason: "비 오는 날 실내 운동",
          matchedTitles: ["운동", "운동"],
        }),
      ];

      // When
      const result = filterWeakPatterns(patterns, baseContext);

      // Then
      expect(result).toHaveLength(0);
    });

    it("2회 반복 + 낮은 confidence 는 제거", () => {
      // Given — CONFIDENCE_GATE_LOW_OCC 미만
      const patterns = [
        makePattern({
          confidence: 0.5,
          matchedTitles: ["운동", "운동"],
        }),
      ];

      // When
      const result = filterWeakPatterns(patterns, baseContext);

      // Then
      expect(result).toHaveLength(0);
    });

    it("2회 반복 + 높은 confidence 는 통과", () => {
      // Given — 0.75 이상
      const patterns = [
        makePattern({
          confidence: 0.8,
          title: "운동 10분",
          matchedTitles: ["운동", "운동"],
        }),
      ];

      // When
      const result = filterWeakPatterns(patterns, baseContext);

      // Then
      expect(result).toHaveLength(1);
    });

    it("서로 다른 제목 2개 이상이면 통과", () => {
      // Given
      const patterns = [makePattern({ matchedTitles: ["운동", "공부"], confidence: 0.6 })];

      // When
      const result = filterWeakPatterns(patterns, baseContext);

      // Then
      expect(result).toHaveLength(1);
    });
  });

  describe("applyTypeCap", () => {
    it("빈 matchedTitles 유형은 NO_MATCH_TYPE_CAP(2) 개로 제한, 매칭 있는 유형은 모두 유지", () => {
      // Given — 빈 유형 3개 + 매칭 있는 유형 2개
      const patterns = [
        makePattern({ title: "시즌1", matchedTitles: [], confidence: 0.9 }),
        makePattern({ title: "시즌2", matchedTitles: [], confidence: 0.8 }),
        makePattern({ title: "시즌3", matchedTitles: [], confidence: 0.7 }),
        makePattern({ title: "반복1", matchedTitles: ["A", "A"] }),
        makePattern({ title: "반복2", matchedTitles: ["B", "B"] }),
      ];

      // When
      const result = applyTypeCap(patterns);

      // Then — 매칭 2 + 빈 유형 상위 2 = 4개
      expect(result).toHaveLength(4);
      const noMatched = result.filter((p) => p.matchedTitles.length === 0);
      expect(noMatched).toHaveLength(2);
      expect(noMatched.map((p) => p.title)).toEqual(["시즌1", "시즌2"]);
    });
  });

  describe("dedupeByTitlePrefixAndDays", () => {
    it("제목 앞 2어절 + daysOfWeek 동일이면 최고 confidence 만 남김", () => {
      // Given — "오전 자기계발 30분" / "오전 자기계발 1시간" 같은 주제 중복
      const patterns = [
        makePattern({
          title: "오전 자기계발 30분",
          daysOfWeek: ["MON", "WED"],
          confidence: 0.75,
        }),
        makePattern({
          title: "오전 자기계발 1시간",
          daysOfWeek: ["MON", "WED"],
          confidence: 0.85,
        }),
        makePattern({
          title: "저녁 운동 20분",
          daysOfWeek: ["TUE"],
          confidence: 0.7,
        }),
      ];

      // When
      const result = dedupeByTitlePrefixAndDays(patterns);

      // Then — "오전 자기계발" 1건 + "저녁 운동" 1건
      expect(result).toHaveLength(2);
      const kept = result.find((p) => p.title.startsWith("오전 자기계발"));
      expect(kept?.title).toBe("오전 자기계발 1시간");
      expect(kept?.confidence).toBe(0.85);
    });

    it("daysOfWeek 가 다르면 별개로 유지", () => {
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

  it("실제 기록에 없는 matchedTitles는 모델이 반복해도 저장 후보가 아니다", () => {
    const result = filterWeakPatterns(
      [makePattern({ matchedTitles: ["달리기", "달리기", "달리기"], confidence: 0.99 })],
      baseContext,
    );
    expect(result).toEqual([]);
  });
  it("실제 2개 기록을 모델이 3개로 부풀리면 저장 후보가 아니다", () => {
    const result = filterWeakPatterns(
      [makePattern({ matchedTitles: ["운동", "운동", "운동"], confidence: 0.99 })],
      baseContext,
    );
    expect(result).toEqual([]);
  });
  it("빈 matchedTitles여도 영어 날씨 이유는 null weather에서 거른다", () => {
    const result = filterWeakPatterns(
      [makePattern({ matchedTitles: [], reason: "RAIN calls for Indoor exercise" })],
      baseContext,
    );
    expect(result).toEqual([]);
  });
  it("시작 기록에 시간 근거가 없으면 모델이 붙인 시각을 제거한다", () => {
    const context = { ...baseContext, todos: baseContext.todos.slice(0, 1) };
    const result = normalizeStarterSuggestions(
      [makePattern({ title: "운동", scheduledTime: "08:00" })],
      context,
    );
    expect(result[0]?.pattern.scheduledTime).toBeNull();
    expect(result[0]?.pattern.matchedTitles).toEqual([]);
    expect(result[0]?.pattern.confidence).toBeLessThanOrEqual(0.6);
  });
  it("시작 기록에 실제 동일 시각이 있으면 그 시각을 유지한다", () => {
    const context = {
      ...baseContext,
      todos: [
        {
          ...baseContext.todos[0],
          title: "운동",
          startDate: "2026-03-02",
          scheduledTime: "08:00",
          categoryId: 1,
          completed: true,
          categoryName: "생활",
        },
      ],
    };
    const result = normalizeStarterSuggestions(
      [makePattern({ title: "운동", scheduledTime: "08:00" })],
      context,
    );
    expect(result[0]?.pattern.scheduledTime).toBe("08:00");
  });
  it.each([
    "준비 운동을 추천해요",
    "Train for the week",
    "실내 운동을 가볍게 해봐요",
    "Try indoor exercise",
  ])("날씨 사실이 아닌 %s 제안은 weather가 없어도 유지한다", (reason) => {
    expect(
      filterWeakPatterns([makePattern({ reason, matchedTitles: [] })], baseContext),
    ).toHaveLength(1);
  });
  it.each(["비가 오는 날이니 실내에서 운동", "비 때문에 산책을 줄여요", "Rain is expected today"])(
    "실제 날씨 주장 %s 제안은 null weather에서 제외한다",
    (reason) => {
      expect(filterWeakPatterns([makePattern({ reason, matchedTitles: [] })], baseContext)).toEqual(
        [],
      );
    },
  );
  it.each([
    { recorded: "독서10분", proposed: "독서5분", allowed: true },
    { recorded: "Read a book", proposed: "Read 5 pages", allowed: true },
    { recorded: "독서 10분", proposed: "달리기 5km", allowed: false },
    { recorded: "독서10분", proposed: "달리기5분", allowed: false },
    { recorded: "Read 10 minutes", proposed: "Run 5 minutes", allowed: false },
    { recorded: "Read a book", proposed: "Run 5 km", allowed: false },
  ])(
    "반복 기록 $recorded → $proposed 의 활동 근거 유지 여부는 $allowed",
    ({ recorded, proposed, allowed }) => {
      const context = {
        ...baseContext,
        todos: ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) => ({
          title: recorded,
          startDate,
          scheduledTime: null,
          categoryId: 1,
          completed: true,
          categoryName: "생활",
        })),
      };
      const result = filterWeakPatterns(
        [
          makePattern({
            title: proposed,
            matchedTitles: [recorded, recorded, recorded],
            confidence: 0.95,
          }),
        ],
        context,
      );
      expect(result).toHaveLength(allowed ? 1 : 0);
    },
  );
  it("실제 세 월요일 기록은 모델의 요일/증량/시각을 기록값으로 교정한다", () => {
    const context = {
      ...baseContext,
      todos: ["2026-09-21", "2026-09-28", "2026-10-05"].map((startDate) => ({
        ...baseContext.todos[0]!,
        title: "책 읽기 10분",
        startDate,
      })),
    };
    const candidates = filterWeakPatterns(
      [
        makePattern({
          title: "책 읽기 15분",
          daysOfWeek: ["SUN"],
          scheduledTime: "08:00",
          matchedTitles: ["책 읽기 10분"],
          confidence: 0.95,
        }),
      ],
      context,
    );
    const result = groundPatternCandidates(candidates, context, []);
    expect(result[0]?.pattern).toMatchObject({
      title: "책 읽기 10분",
      daysOfWeek: ["MON"],
      scheduledTime: null,
      matchedTitles: ["책 읽기 10분", "책 읽기 10분", "책 읽기 10분"],
    });
    expect(result[0]?.recordedActivity?.occurrences).toBe(3);
  });
  it("거절한 원본 활동은 다른 분량 title로 포장해도 반복 후보에서 제외한다", () => {
    const patterns = [makePattern({ title: "운동 20분", matchedTitles: ["운동"] })];
    expect(groundPatternCandidates(patterns, baseContext, ["운동"])).toEqual([]);
  });
  it.each(["러닝", "러닝 30분"])(
    "희소 %s는 모델의 새 분량 없이 실제 활동·요일로 정규화한다",
    (title) => {
      const context = {
        ...baseContext,
        todos: [{ ...baseContext.todos[0]!, title, startDate: "2026-03-18" }],
      };
      const result = normalizeStarterSuggestions(
        [makePattern({ title: "러닝 15분", daysOfWeek: ["SUN"], confidence: 0.95 })],
        context,
      );
      expect(result[0]?.pattern).toMatchObject({
        title,
        daysOfWeek: ["WED"],
        confidence: 0.6,
        matchedTitles: [],
      });
      expect(result[0]?.recordedActivity.occurrences).toBe(1);
    },
  );
  it("산책 기록의 시작 제안을 무관한 스트레칭으로 바꾸지 않는다", () => {
    const context = { ...baseContext, todos: [{ ...baseContext.todos[0]!, title: "산책" }] };
    expect(normalizeStarterSuggestions([makePattern({ title: "스트레칭 10분" })], context)).toEqual(
      [],
    );
  });
  it("책 기록의 한 글자 부분 일치로 산책을 같은 활동으로 처리하지 않는다", () => {
    // Given - 기록된 책 읽기와 별개의 산책 제안
    const context = {
      ...baseContext,
      todos: [{ ...baseContext.todos[0]!, title: "책 읽기 10분" }],
    };
    const pattern = makePattern({ title: "봄 산책", matchedTitles: [] });
    // When / Then - 희소 기록에서는 다른 활동을 대체하지 않고, 일반 보완 유형은 유지
    expect(normalizeStarterSuggestions([pattern], context)).toEqual([]);
    expect(groundPatternCandidates([pattern], context, [])[0]?.pattern.title).toBe("봄 산책");
  });
  it("다중 근거의 정확한 원본 제목과 사용자 분량을 먼저 보존한다", () => {
    const context = {
      ...baseContext,
      todos: [
        { ...baseContext.todos[0]!, title: "러닝", completed: true },
        { ...baseContext.todos[0]!, title: "러닝 30분", completed: false },
      ],
    };
    const result = groundPatternCandidates(
      [makePattern({ title: "러닝 30분", matchedTitles: ["러닝", "러닝 30분"] })],
      context,
      [],
    );
    expect(result[0]?.pattern.title).toBe("러닝 30분");
  });
});

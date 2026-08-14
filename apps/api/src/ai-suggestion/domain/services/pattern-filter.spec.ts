/**
 * pattern-filter.util — 순수 함수 유닛 테스트
 */

import type { SuggestionContext } from "../types";
import {
	applyTypeCap,
	dedupeByTitlePrefixAndDays,
	filterWeakPatterns,
	isWeatherRelated,
	mergeUniquePatterns,
} from "./pattern-filter";
import type { DetectedPatternsResponse } from "./prompts/detect-patterns.prompt";

type Pattern = DetectedPatternsResponse["patterns"][number];

const makePattern = (overrides: Partial<Pattern> = {}): Pattern => ({
	title: "테스트 제안",
	daysOfWeek: ["MON"],
	scheduledTime: null,
	confidence: 0.8,
	reason: "기본 이유",
	matchedTitles: ["매칭1", "매칭2"],
	...overrides,
});

const baseContext: SuggestionContext = {
	todos: [],
	dayCompletionRates: "",
	timeCompletionRates: "",
	categoryRates: "",
	streak: "",
	missingRoutines: [],
	weather: null,
	currentDate: "2026-04-18",
	weeklyReportInsight: null,
	suggestionHistory: [],
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

	describe("mergeUniquePatterns", () => {
		it("제목 기준으로 중복 없는 패턴만 병합", () => {
			// Given
			const primary = [makePattern({ title: "A" }), makePattern({ title: "B" })];
			const secondary = [makePattern({ title: "A" }), makePattern({ title: "C" })];

			// When
			const result = mergeUniquePatterns(primary, secondary);

			// Then — A는 primary 만, C 신규
			expect(result.map((p) => p.title)).toEqual(["A", "B", "C"]);
		});
	});
});

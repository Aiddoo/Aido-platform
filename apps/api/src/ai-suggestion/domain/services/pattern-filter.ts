/**
 * AI Suggestion 패턴 필터/캡/중복제거 순수 함수 유틸
 *
 * 서비스 오케스트레이션에서 분리된 도메인 순수 로직.
 * 외부 의존성(DB/Queue/Network) 없이 입력 → 출력만으로 정의되어 테스트·재사용이 용이.
 */
import { AI_SUGGESTION_LIMITS } from "@aido/validators";
import type { SuggestionContext } from "../types";
import type { DetectedPatternsResponse } from "./prompts/detect-patterns.prompt";

type Pattern = DetectedPatternsResponse["patterns"][number];

const WEATHER_KEYWORDS = [
	"날씨",
	"비",
	"눈",
	"소나기",
	"우천",
	"실내",
	"악천후",
] as const;

/**
 * reason 텍스트에서 날씨 관련 키워드 포함 여부 감지.
 */
export function isWeatherRelated(reason: string): boolean {
	return WEATHER_KEYWORDS.some((keyword) => reason.includes(keyword));
}

/**
 * AI가 반환한 패턴 중 약한 패턴을 필터링.
 *
 * - 시즌/밸런스(matchedTitles 빈 배열): 허용
 * - 날씨 관련 제안이지만 날씨 컨텍스트 없음: 제거
 * - 단순 반복(같은 제목): 2회+면 인정하되 신뢰도 게이트 적용
 * - 순차/발전(서로 다른 제목): 2개 이상이면 허용
 */
export function filterWeakPatterns(
	patterns: Pattern[],
	context: SuggestionContext,
): Pattern[] {
	return patterns.filter((p) => {
		if (p.matchedTitles.length === 0) {
			return true;
		}

		if (!context.weather && isWeatherRelated(p.reason)) {
			return false;
		}

		const uniqueTitles = new Set(p.matchedTitles);
		const isRepetition = uniqueTitles.size === 1;

		if (isRepetition) {
			const count = p.matchedTitles.length;
			if (count < AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES) {
				return false;
			}
			const gate =
				count === AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES
					? AI_SUGGESTION_LIMITS.CONFIDENCE_GATE_LOW_OCC
					: AI_SUGGESTION_LIMITS.CONFIDENCE_GATE_MULTI_OCC;
			return p.confidence >= gate;
		}

		return p.matchedTitles.length >= 2;
	});
}

/**
 * matchedTitles 가 빈 유형(시즌/밸런스) 의 개수를 캡으로 제한.
 * 빈 유형이 과다하게 남아 제안이 획일화되는 것을 방지.
 */
export function applyTypeCap(patterns: Pattern[]): Pattern[] {
	const noMatchCap = AI_SUGGESTION_LIMITS.NO_MATCH_TYPE_CAP;
	const matched: Pattern[] = [];
	const noMatched: Pattern[] = [];
	for (const p of patterns) {
		if (p.matchedTitles.length === 0) {
			noMatched.push(p);
			continue;
		}
		matched.push(p);
	}
	const cappedNoMatched = [...noMatched]
		.sort((a, b) => b.confidence - a.confidence)
		.slice(0, noMatchCap);
	return [...matched, ...cappedNoMatched];
}

/**
 * 제목 앞 2어절 + daysOfWeek 세트가 같으면 실질 동일 제안으로 간주해 중복 제거.
 * 동일 키 후보가 여러 개면 가장 높은 confidence 하나만 유지.
 *
 * Live QA 에서 관찰된 "오전 자기계발 30분" / "오전 자기계발 1시간" 같은
 * 시간 파라미터만 다른 중복을 잡기 위함.
 */
export function dedupeByTitlePrefixAndDays(patterns: Pattern[]): Pattern[] {
	const seen = new Map<string, Pattern>();
	for (const p of patterns) {
		const firstTwoWords = p.title.trim().split(/\s+/).slice(0, 2).join(" ");
		const daysKey = [...p.daysOfWeek].sort().join(",");
		const key = `${firstTwoWords}|${daysKey}`;
		const existing = seen.get(key);
		if (!existing || p.confidence > existing.confidence) {
			seen.set(key, p);
		}
	}
	return [...seen.values()];
}

/**
 * 두 패턴 리스트를 제목 기준으로 중복 제거하여 병합.
 * 1차 결과가 임계치 미만이라 재시도했을 때 사용.
 */
export function mergeUniquePatterns(
	primary: Pattern[],
	secondary: Pattern[],
): Pattern[] {
	const seen = new Set(primary.map((p) => p.title));
	const merged = [...primary];
	for (const p of secondary) {
		if (seen.has(p.title)) {
			continue;
		}
		merged.push(p);
		seen.add(p.title);
	}
	return merged;
}

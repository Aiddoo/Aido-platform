/**
 * AI 제안 저장 전 사유·중복을 거르는 순수 함수.
 * 근거 검증(후보·요일·시각)은 suggestion-candidates가 맡는다.
 */
import type { DetectedPattern } from "./suggestion.constants.js";

const WEATHER_CLAIM =
  /날씨|우천|강수|폭우|폭설|강설|소나기|악천후|(?:^|[\s(])비(?:가|는|를|로|와)?(?:\s|[,.)!?]|$)|비가\s*(?:오|내리)|비\s*오는|눈이\s*(?:오|내리)|눈\s*오는|\b(?:weather|rain(?:y|ing)?|snow(?:y|ing)?|showers?|storms?)\b/iu;

/**
 * reason 텍스트에서 날씨 관련 키워드 포함 여부 감지.
 */
export function isWeatherRelated(reason: string): boolean {
  return WEATHER_CLAIM.test(reason);
}

/**
 * 제목 앞 2어절 + daysOfWeek 세트가 같으면 실질 동일 제안으로 간주해 중복 제거.
 * 동일 키 후보가 여러 개면 가장 높은 confidence 하나만 유지.
 *
 * Live QA 에서 관찰된 "오전 자기계발 30분" / "오전 자기계발 1시간" 같은
 * 시간 파라미터만 다른 중복을 잡기 위함.
 */
export function dedupeByTitlePrefixAndDays(patterns: DetectedPattern[]): DetectedPattern[] {
  const seen = new Map<string, DetectedPattern>();
  for (const p of patterns) {
    const firstTwoWords = p.title.trim().split(/\s+/).slice(0, 2).join(" ");
    const daysKey = [...p.daysOfWeek].sort().join(",");
    const key = `${firstTwoWords}|${daysKey}`;
    const existing = seen.get(key);
    if (existing == null || p.confidence > existing.confidence) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

import type { DetectedPattern } from "./suggestions.constants.js";

/**
 * 제목 앞 2어절 + daysOfWeek 세트가 같으면 실질 동일 제안으로 간주해 중복 제거.
 * 동일 키 후보가 여러 개면 가장 높은 confidence 하나만 유지.
 *
 * Live QA 에서 관찰된 "오전 자기계발 30분" / "오전 자기계발 1시간" 같은
 * 시간 파라미터만 다른 중복을 잡기 위함.
 */
export function dedupeByTitlePrefixAndDays(patterns: DetectedPattern[]): DetectedPattern[] {
  const seen = new Map<string, DetectedPattern>();
  for (const pattern of patterns) {
    const firstTwoWords = pattern.title.trim().split(/\s+/).slice(0, 2).join(" ");
    const daysKey = pattern.daysOfWeek.toSorted().join(",");
    const key = `${firstTwoWords}|${daysKey}`;
    const existing = seen.get(key);
    if (existing == null || pattern.confidence > existing.confidence) {
      seen.set(key, pattern);
    }
  }
  return [...seen.values()];
}

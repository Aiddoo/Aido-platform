/**
 * AI Suggestion 패턴 필터/캡/중복제거 순수 함수 유틸
 *
 * 서비스 오케스트레이션에서 분리된 도메인 순수 로직.
 * 외부 의존성(DB/Queue/Network) 없이 입력 → 출력만으로 정의되어 테스트·재사용이 용이.
 */
import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import type {
  DetectedPattern,
  PatternEvidenceContext,
  RecordedActivityEvidence,
} from "../../types/suggestions/ai-suggestion.types.js";
import { collectRecordedActivities, selectRecordedDays } from "./recorded-activity-evidence.js";

type Pattern = DetectedPattern;

const WEATHER_CLAIM =
  /날씨|우천|강수|폭우|폭설|강설|소나기|악천후|(?:^|[\s(])비(?:가|는|를|로|와)?(?:\s|[,.)!?]|$)|비가\s*(?:오|내리)|비\s*오는|눈이\s*(?:오|내리)|눈\s*오는|\b(?:weather|rain(?:y|ing)?|snow(?:y|ing)?|showers?|storms?)\b/iu;
const TITLE_FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "for",
  "and",
  "in",
  "on",
  "at",
  "with",
  "분",
  "시간",
  "초",
  "minute",
  "minutes",
  "hour",
  "hours",
]);

function hasRecordedActivityTitle(title: string, recordedTitle: string): boolean {
  const candidateWords: readonly string[] = title.toLowerCase().match(/\p{L}+/gu) ?? [];
  const recordedWords: readonly string[] = recordedTitle.toLowerCase().match(/\p{L}+/gu) ?? [];
  return recordedWords
    .filter((word) => !TITLE_FUNCTION_WORDS.has(word))
    .some((word) =>
      /[가-힣]/u.test(word) && word.length > 1
        ? title.includes(word)
        : candidateWords.includes(word),
    );
}

/**
 * reason 텍스트에서 날씨 관련 키워드 포함 여부 감지.
 */
export function isWeatherRelated(reason: string): boolean {
  return WEATHER_CLAIM.test(reason);
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
  context: PatternEvidenceContext,
): Pattern[] {
  const titleCounts = new Map<string, number>();
  for (const todo of context.todos)
    titleCounts.set(todo.title, (titleCounts.get(todo.title) ?? 0) + 1);

  return patterns.filter((pattern) => {
    if (context.weather === null && isWeatherRelated(pattern.reason)) return false;
    if (pattern.matchedTitles.length === 0) return true;

    // 모델이 제시한 근거는 실제 기록의 제목과 개수를 넘을 수 없다.
    const claimedCounts = new Map<string, number>();
    for (const title of pattern.matchedTitles)
      claimedCounts.set(title, (claimedCounts.get(title) ?? 0) + 1);
    for (const [title, count] of claimedCounts) {
      if (count > (titleCounts.get(title) ?? 0)) return false;
    }
    if (claimedCounts.size > 1) return pattern.matchedTitles.length >= 2;
    const repeatedTitle = pattern.matchedTitles[0];
    // 반복형은 기록의 활동을 알아볼 수 있어야 한다. 의미 전체를 검증하는 규칙은 아니다.
    if (repeatedTitle === undefined || !hasRecordedActivityTitle(pattern.title, repeatedTitle))
      return false;

    const count = titleCounts.get(repeatedTitle) ?? 0;
    if (count < AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES) return false;
    const gate =
      count === AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES
        ? AI_SUGGESTION_LIMITS.CONFIDENCE_GATE_LOW_OCC
        : AI_SUGGESTION_LIMITS.CONFIDENCE_GATE_MULTI_OCC;
    return pattern.confidence >= gate;
  });
}

function findRecordedActivity(
  title: string,
  activities: readonly RecordedActivityEvidence[],
): RecordedActivityEvidence | undefined {
  const exact = activities.find((activity) => activity.title === title);
  if (exact !== undefined) return exact;
  return activities
    .filter((activity) => hasRecordedActivityTitle(title, activity.title))
    .sort(
      (left, right) =>
        right.completedOccurrences - left.completedOccurrences ||
        right.occurrences - left.occurrences,
    )[0];
}

export interface StarterPatternCandidate {
  readonly pattern: DetectedPattern;
  readonly recordedActivity: RecordedActivityEvidence;
}

/** 시작 제안도 기록된 활동·분량·요일을 그대로 사용하며 새 시각을 만들지 않는다. */
export function normalizeStarterSuggestions(
  patterns: Pattern[],
  context: PatternEvidenceContext,
): StarterPatternCandidate[] {
  const activities = collectRecordedActivities(context.todos);
  return patterns.flatMap((pattern) => {
    if (context.weather === null && isWeatherRelated(pattern.reason)) return [];
    const activity = findRecordedActivity(pattern.title, activities);
    if (activity === undefined) return [];
    return [
      {
        pattern: {
          ...pattern,
          title: activity.title,
          daysOfWeek: selectRecordedDays(activity),
          confidence: Math.min(pattern.confidence, 0.6),
          scheduledTime:
            pattern.scheduledTime !== null && activity.recordedTimes.includes(pattern.scheduledTime)
              ? pattern.scheduledTime
              : null,
          matchedTitles: [],
        },
        recordedActivity: activity,
      },
    ];
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
    if (existing === undefined || p.confidence > existing.confidence) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

export interface GroundedPatternCandidate {
  readonly pattern: DetectedPattern;
  readonly recordedActivity: RecordedActivityEvidence | null;
}

/** 근거가 있는 활동의 요일·시각·제목은 모델 추정 대신 실제 기록으로 결정한다. */
export function groundPatternCandidates(
  patterns: readonly DetectedPattern[],
  context: PatternEvidenceContext,
  excludedTitles: readonly string[],
): GroundedPatternCandidate[] {
  const evidenceByTitle = new Map(
    collectRecordedActivities(context.todos).map((evidence) => [evidence.title, evidence]),
  );
  const excluded = new Set(excludedTitles);
  return patterns.flatMap((pattern) => {
    const matchedTitles = [...new Set(pattern.matchedTitles)];
    const matchedActivities = matchedTitles.flatMap((title) => {
      const activity = evidenceByTitle.get(title);
      return activity === undefined ? [] : [activity];
    });
    const evidence = findRecordedActivity(pattern.title, matchedActivities);
    if (matchedTitles.length > 0 && evidence === undefined) return [];
    const relatedActivity =
      matchedTitles.length === 0
        ? findRecordedActivity(pattern.title, [...evidenceByTitle.values()])
        : undefined;
    if (relatedActivity !== undefined && pattern.title !== relatedActivity.title) return [];
    if (excluded.has(pattern.title) || (evidence !== undefined && excluded.has(evidence.title))) {
      return [];
    }
    const timeEvidence = evidence ?? relatedActivity;
    const scheduledTime =
      pattern.scheduledTime !== null &&
      (timeEvidence !== undefined
        ? timeEvidence.recordedTimes.includes(pattern.scheduledTime)
        : context.todos.some((todo) => todo.scheduledTime === pattern.scheduledTime))
        ? pattern.scheduledTime
        : null;
    return [
      {
        pattern: {
          ...pattern,
          ...(evidence !== undefined
            ? {
                title: evidence.title,
                daysOfWeek: selectRecordedDays(evidence),
                matchedTitles: Array.from({ length: evidence.occurrences }, () => evidence.title),
              }
            : {}),
          scheduledTime,
        },
        recordedActivity: evidence ?? null,
      },
    ];
  });
}

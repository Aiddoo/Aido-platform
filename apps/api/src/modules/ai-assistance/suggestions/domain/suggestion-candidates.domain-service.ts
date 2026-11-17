import {
  AI_SUGGESTION_LIMITS,
  completionRate,
  DAYS_OF_WEEK,
  type DayOfWeek,
} from "@aido/api/vocabulary";

import {
  collectRecordedActivities,
  selectRecordedDays,
  toActivityKey,
} from "./recorded-activity-evidence.domain-service.js";
import type { TodoSummaryForAnalysis } from "./suggestions.constants.js";

/** 프롬프트에 넣는 후보 수 상한 */
export const MAX_SUGGESTION_CANDIDATES = 30;
/** 시작 단계(기록 3개 미만)에서 고를 수 있는 제안 수 */
const MAX_STARTER_PICKS = 2;

export const SUGGESTION_MODES = ["PATTERN", "STARTER"] as const;

export type SuggestionMode = (typeof SUGGESTION_MODES)[number];

/** 실제 기록에서 서버가 만든 제안 후보. LLM은 id와 요일만 고른다. */
export interface SuggestionCandidate {
  readonly id: string;
  readonly title: string;
  readonly occurrences: number;
  readonly completed: number;
  /** 끝낸 비율(정수 %). 모델이 직접 나누지 않게 서버가 넣는다 */
  readonly completionRate: number;
  readonly days: readonly {
    readonly day: DayOfWeek;
    readonly total: number;
    readonly completed: number;
  }[];
  /** 같은 시각이 2회 이상 기록됐을 때만 HH:mm */
  readonly recordedTime: string | null;
  readonly categoryName: string;
}

export interface SuggestionPick {
  readonly candidateId: string;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly useRecordedTime: boolean;
}

export interface ResolvedSuggestionPick {
  readonly candidate: SuggestionCandidate;
  readonly daysOfWeek: DayOfWeek[];
  readonly scheduledTime: string | null;
  readonly confidence: number;
}

export function suggestionModeOf(todoCount: number): SuggestionMode {
  return todoCount < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES ? "STARTER" : "PATTERN";
}

/**
 * 많이 기록하고 많이 끝낸 활동부터 최대 30개다. PATTERN은 한 번뿐인 활동을 모델에 보이지 않고,
 * 이미 반복 중인 할 일과 같은 활동은 어느 모드에서도 넣지 않는다.
 */
export function buildSuggestionCandidates(
  todos: readonly TodoSummaryForAnalysis[],
  mode: SuggestionMode,
  repeatingTitles: readonly string[],
): SuggestionCandidate[] {
  const minOccurrences = mode === "PATTERN" ? AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES : 1;
  const repeatingKeys = new Set(repeatingTitles.map(toActivityKey));
  return collectRecordedActivities(todos)
    .filter(
      (activity) => activity.occurrences >= minOccurrences && !repeatingKeys.has(activity.key),
    )
    .sort(
      (left, right) =>
        right.occurrences - left.occurrences ||
        right.completedOccurrences - left.completedOccurrences ||
        left.title.localeCompare(right.title),
    )
    .slice(0, MAX_SUGGESTION_CANDIDATES)
    .map((activity, index) => ({
      id: `a${index + 1}`,
      title: activity.title,
      occurrences: activity.occurrences,
      completed: activity.completedOccurrences,
      completionRate: completionRate(activity.completedOccurrences, activity.occurrences),
      days: activity.days,
      recordedTime: activity.recordedTime,
      categoryName: activity.categoryName,
    }));
}

/** 근거 기반 신뢰도. 같은 활동을 여러 번 끝냈을수록 높다. */
export function suggestionConfidence(candidate: SuggestionCandidate, mode: SuggestionMode): number {
  if (mode === "STARTER") {
    return 0.55;
  }
  const completionRate = candidate.completed / candidate.occurrences;
  if (candidate.occurrences >= 3 && completionRate >= 0.6) {
    return Math.round((0.8 + 0.15 * completionRate) * 100) / 100;
  }
  return 0.65;
}

export function resolveSuggestionPicks(
  picks: readonly SuggestionPick[],
  candidates: readonly SuggestionCandidate[],
  options: { readonly mode: SuggestionMode; readonly excludedTitles: readonly string[] },
): ResolvedSuggestionPick[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const excludedKeys = new Set(options.excludedTitles.map(toActivityKey));
  const seen = new Set<string>();
  const maxPicks =
    options.mode === "STARTER" ? MAX_STARTER_PICKS : AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER;
  const resolved: ResolvedSuggestionPick[] = [];
  for (const pick of picks) {
    const candidate = byId.get(pick.candidateId);
    if (
      candidate == null ||
      seen.has(candidate.id) ||
      excludedKeys.has(toActivityKey(candidate.title))
    ) {
      continue;
    }
    seen.add(candidate.id);
    const recordedDays = new Set(candidate.days.map((day) => day.day));
    const chosen = DAYS_OF_WEEK.filter(
      (day) => recordedDays.has(day) && pick.daysOfWeek.includes(day),
    );
    resolved.push({
      candidate,
      daysOfWeek: chosen.length > 0 ? chosen : selectRecordedDays(candidate),
      scheduledTime: pick.useRecordedTime ? candidate.recordedTime : null,
      confidence: suggestionConfidence(candidate, options.mode),
    });
    if (resolved.length >= maxPicks) {
      break;
    }
  }
  return resolved;
}

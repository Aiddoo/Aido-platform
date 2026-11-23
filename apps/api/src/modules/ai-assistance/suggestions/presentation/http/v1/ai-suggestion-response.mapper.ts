import type {
  RecurringSuggestion,
  SuggestionActionResponse,
  SuggestionAnalysis,
  SuggestionAnalysisResponse,
  SuggestionListResponse,
} from "@aido/api/contracts/ai/v1";
import { pick } from "es-toolkit";

import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  PendingSuggestionsReadModel,
  SuggestionAnalysisReadModel,
} from "../../../application/read-models/suggestion-analysis.read-model.js";
import type { SuggestionActionResult } from "../../../application/use-cases/handle-suggestion-action.use-case.js";
import type { Suggestion } from "../../../domain/suggestion.aggregate.js";

// 출시 앱은 표시하지 않지만 응답 계약이라 문구를 그대로 둔다
const SUGGESTION_ACTION_MESSAGES = {
  ACCEPTED: "제안이 수락되어 반복 할 일이 생성되었습니다.",
  DISMISSED: "제안이 거절되었습니다.",
} as const;

export function toSuggestionResponse(suggestion: Suggestion): RecurringSuggestion {
  const primitives = suggestion.toPrimitives();
  return {
    id: primitives.id,
    title: primitives.title,
    daysOfWeek: primitives.daysOfWeek == null ? [] : [...primitives.daysOfWeek],
    scheduledTime: primitives.scheduledTime,
    confidence: primitives.confidence,
    reason: primitives.reason,
    status: primitives.status,
    expiresAt: toIsoString(primitives.expiresAt),
    createdAt: toIsoString(primitives.createdAt),
    suggestedCategoryId: primitives.suggestedCategoryId,
    evidence:
      primitives.evidence == null
        ? null
        : pick(primitives.evidence, ["recordedCount", "completedCount", "periodDays"]),
  };
}

function toSuggestionAnalysis(analysis: SuggestionAnalysisReadModel): SuggestionAnalysis {
  return {
    state: analysis.state,
    canRequestNow: analysis.canRequestNow,
    nextAnalysisAt: toIsoString(analysis.nextAnalysisAt),
  };
}

export function toSuggestionAnalysisResponse(
  analysis: SuggestionAnalysisReadModel,
): SuggestionAnalysisResponse {
  return { analysis: toSuggestionAnalysis(analysis) };
}

export function toSuggestionListResponse(
  pendingSuggestions: PendingSuggestionsReadModel,
): SuggestionListResponse {
  return {
    suggestions: pendingSuggestions.suggestions.map(toSuggestionResponse),
    analysis: toSuggestionAnalysis(pendingSuggestions.analysis),
  };
}

export function toSuggestionActionResponse(
  result: SuggestionActionResult,
): SuggestionActionResponse {
  return {
    message:
      result.createdTodosCount == null
        ? SUGGESTION_ACTION_MESSAGES.DISMISSED
        : SUGGESTION_ACTION_MESSAGES.ACCEPTED,
    suggestion: toSuggestionResponse(result.suggestion),
    ...(result.createdTodosCount != null && { createdTodosCount: result.createdTodosCount }),
  };
}

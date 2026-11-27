import { useSuggestionApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import {
  type EntitlementSnapshot,
  EntitlementPolicy,
} from '@src/features/billing/subscription/domains/entitlement.model';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';
import { take } from 'es-toolkit';

import { PREVIEW_SUGGESTION_COUNT } from '../constants/suggestion.constants';
import { type AiSuggestionList, AiSuggestionListPolicy } from '../domains/ai-suggestion-list.model';
import { SuggestionAnalysisPolicy } from '../domains/suggestion-analysis.model';
import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

const SUGGESTION_ANALYSIS_POLL_INTERVAL_MS = 3 * SECOND_MS;

export function useGetSuggestionsQueryOptions() {
  const suggestionApi = useSuggestionApi();

  return queryOptions({
    queryKey: SUGGESTION_QUERY_KEYS.list(),
    queryFn: async ({ signal, client }) => {
      const result = await suggestionApi.getSuggestions(signal);
      // 스냅샷이 늦어 프리미엄으로 물었다. 기다려야 입구가 내려가며 스냅샷 다시 받기를 취소(revert)하지 않는다
      if (!result.ok && isSuggestionsPremiumRequiredError(result.error)) {
        await invalidateEntitlements(client);
      }
      return unwrap(result);
    },
    refetchInterval: (query) => {
      const analysis = query.state.data?.analysis;
      if (analysis == null || !SuggestionAnalysisPolicy.shouldWaitForResult(analysis)) {
        return false;
      }
      return SUGGESTION_ANALYSIS_POLL_INTERVAL_MS;
    },
    meta: { refreshOnPremiumChange: true, refreshOnAiConsentChange: true },
  });
}

export const SuggestionListSelect = {
  /** 피드 입구의 한 줄. 상태와 제안 수만 골라 제안 내용이 바뀌어도 다시 그리지 않는다 */
  entry: (list: AiSuggestionList) => ({
    state: AiSuggestionListPolicy.getDisplayState(list),
    count: list.suggestions.length,
  }),

  preview: (list: AiSuggestionList) => take(list.suggestions, PREVIEW_SUGGESTION_COUNT),
};

export function selectCanUseSuggestions(snapshot: EntitlementSnapshot) {
  return EntitlementPolicy.canUseFeature(snapshot, 'AI_SUGGESTION');
}

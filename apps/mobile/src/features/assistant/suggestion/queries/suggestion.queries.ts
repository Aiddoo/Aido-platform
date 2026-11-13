import { useSuggestionApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { queryOptions } from '@tanstack/react-query';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

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
    meta: { refreshOnPremiumChange: true },
  });
}

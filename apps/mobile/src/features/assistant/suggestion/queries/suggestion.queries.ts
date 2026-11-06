import { ErrorCode } from '@aido/api/errors';
import { useSuggestionService } from '@src/bootstrap/providers/di-context';
import type { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import { SUGGESTION_QUERY_KEYS } from '@src/features/assistant/suggestion/constants/suggestion-query-keys';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

function getSuggestionsQueryOptions(suggestionService: SuggestionService) {
  return queryOptions({
    queryKey: SUGGESTION_QUERY_KEYS.suggestions(),
    queryFn: async ({ signal }) => {
      const result = await suggestionService.getSuggestions(signal);
      return unwrap(result);
    },
    throwOnError: (error, query) =>
      query.state.data == null && !isSuggestionsPremiumRequiredError(error),
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetSuggestionsQueryOptions() {
  return getSuggestionsQueryOptions(useSuggestionService());
}

export const isSuggestionsPremiumRequiredError = (error: unknown): boolean =>
  isApiError(error) && error.hasCode(ErrorCode.AI_1309);

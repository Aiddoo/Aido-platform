import { ErrorCode } from '@aido/errors';
import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/services/ai.service';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export function getSuggestionsQueryOptions(aiService: AiService) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.suggestions(),
    queryFn: async ({ signal }) => {
      const result = await aiService.getSuggestions(signal);
      return unwrap(result);
    },
    throwOnError: (error, query) =>
      query.state.data === undefined && !isSuggestionsPremiumRequiredError(error),
  });
}

export function useGetSuggestionsQueryOptions() {
  return getSuggestionsQueryOptions(useAiService());
}

export const isSuggestionsPremiumRequiredError = (error: unknown): boolean =>
  isApiError(error) && error.hasCode(ErrorCode.AI_1309);

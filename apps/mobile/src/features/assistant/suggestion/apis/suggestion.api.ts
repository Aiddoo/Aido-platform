import { suggestionActionResponseSchema, suggestionListResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { AiSuggestionActionInput } from '../schemas/suggestion-action-request.schema';
import { toAiSuggestion } from './suggestion.mapper';

export class SuggestionApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getSuggestions = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/suggestions', { signal }),
      suggestionListResponseSchema,
      (dto) => dto.suggestions.map(toAiSuggestion),
      '[SuggestionApi] Invalid getSuggestions response',
    );

  actOnSuggestion = async (suggestionId: number, input: AiSuggestionActionInput) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/ai/suggestions/${suggestionId}`, input),
      suggestionActionResponseSchema,
      (dto) => toAiSuggestion(dto.suggestion),
      '[SuggestionApi] Invalid actOnSuggestion response',
    );
}

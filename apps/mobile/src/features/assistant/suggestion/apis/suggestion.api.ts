import {
  suggestionActionResponseSchema,
  suggestionAnalysisResponseSchema,
  suggestionListResponseSchema,
} from '@aido/api/contracts/ai/v1';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { AiSuggestionActionInput } from '../schemas/suggestion-action-request.schema';
import { toAiSuggestion, toAiSuggestionList, toSuggestionAnalysis } from './suggestion.mapper';

export class SuggestionApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getSuggestions = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/suggestions', { signal }),
      suggestionListResponseSchema,
      toAiSuggestionList,
      '[SuggestionApi] Invalid getSuggestions response',
    );

  requestAnalysis = async () =>
    parseApiResponse(
      await this.#httpClient.post('v1/ai/suggestions/analyses'),
      suggestionAnalysisResponseSchema,
      (dto) => toSuggestionAnalysis(dto.analysis),
      '[SuggestionApi] Invalid requestAnalysis response',
    );

  actOnSuggestion = async (suggestionId: number, input: AiSuggestionActionInput) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/ai/suggestions/${suggestionId}`, input),
      suggestionActionResponseSchema,
      (dto) => toAiSuggestion(dto.suggestion),
      '[SuggestionApi] Invalid actOnSuggestion response',
    );
}

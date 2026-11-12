import { suggestionActionResponseSchema, suggestionListResponseSchema } from '@aido/api';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { SUGGESTION_LOG_EVENT } from '../constants/suggestion-log-events';
import type { AiSuggestionActionInput } from '../schemas/suggestion-action-request.schema';
import { toAiSuggestion } from './suggestion.mapper';

export class SuggestionApi {
  readonly #httpClient: HttpClient;
  readonly #logger: AppLogger;

  constructor(httpClient: HttpClient, logger: AppLogger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getSuggestions = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/suggestions', { signal }),
      suggestionListResponseSchema,
      (dto) => dto.suggestions.map(toAiSuggestion),
      '[SuggestionApi] Invalid getSuggestions response',
      this.#logInvalid('getSuggestions'),
    );

  actOnSuggestion = async (suggestionId: number, input: AiSuggestionActionInput) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/ai/suggestions/${suggestionId}`, input),
      suggestionActionResponseSchema,
      (dto) => toAiSuggestion(dto.suggestion),
      '[SuggestionApi] Invalid actOnSuggestion response',
      this.#logInvalid('actOnSuggestion'),
    );

  #logInvalid = (method: string) => (zodError: string) =>
    this.#logger.error(SUGGESTION_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
      method,
      zodError,
    });
}

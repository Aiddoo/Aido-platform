import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { SUGGESTION_LOG_EVENT } from '../constants/suggestion-log-events';
import {
  type AiSuggestionActionInput,
  suggestionActionResultSchema,
  suggestionListResultSchema,
} from '../schemas/suggestion.schema';

export class SuggestionService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getSuggestions = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/suggestions', { signal }),
      suggestionListResultSchema,
      (dto) => dto.suggestions,
      '[SuggestionService] Invalid getSuggestions response',
      this.#logInvalid('getSuggestions'),
    );

  actOnSuggestion = async (suggestionId: number, input: AiSuggestionActionInput) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/ai/suggestions/${suggestionId}`, input),
      suggestionActionResultSchema,
      (dto) => dto,
      '[SuggestionService] Invalid actOnSuggestion response',
      this.#logInvalid('actOnSuggestion'),
    );

  #logInvalid = (method: string) => (zodError: string) =>
    this.#logger.error(SUGGESTION_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
      method,
      zodError,
    });
}

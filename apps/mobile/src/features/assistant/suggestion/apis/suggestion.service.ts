import { suggestionActionResponseSchema, suggestionListResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { SUGGESTION_LOG_EVENT } from '../constants/suggestion-log-events';
import type {
  AiSuggestion,
  AiSuggestionActionInput,
  AiSuggestionActionResult,
} from '../domains/suggestion.model';
import { toAiSuggestion, toAiSuggestionActionResult } from './suggestion.mapper';

export class SuggestionService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getSuggestions = async (signal?: AbortSignal): Promise<Result<AiSuggestion[], ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/suggestions', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = suggestionListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(SUGGESTION_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getSuggestions',
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[SuggestionService] Invalid getSuggestions response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.suggestions.map(toAiSuggestion));
  };

  handleSuggestionAction = async (
    suggestionId: number,
    input: AiSuggestionActionInput,
  ): Promise<Result<AiSuggestionActionResult, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/ai/suggestions/${suggestionId}`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = suggestionActionResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(SUGGESTION_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'handleSuggestionAction',
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[SuggestionService] Invalid handleSuggestionAction response: ${parsed.error.message}`,
      );
    }

    return ok(toAiSuggestionActionResult(parsed.data));
  };
}

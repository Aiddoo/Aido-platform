import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  aiUsageResponseSchema,
  parseMemoResponseSchema,
  parseTodoResponseSchema,
  reportStatusResponseSchema,
  suggestionActionResponseSchema,
  suggestionListResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { AI_LOG_EVENT } from '../constants/ai-log-events';
import type { AiUsage } from '../domains/ai-usage.model';
import type {
  AiReport,
  AiSuggestion,
  AiSuggestionActionInput,
  AiSuggestionActionResult,
  GetAiReportsParams,
  ParsedMemoResult,
  ReportStatus,
} from '../domains/ai.model';
import type { ParsedTodoResult } from '../domains/parsed-todo.model';
import { toAiUsage } from './ai-usage.mapper';
import {
  toAiReport,
  toAiSuggestion,
  toAiSuggestionActionResult,
  toParsedMemoResult,
  toReportStatus,
} from './ai.mapper';
import { toParsedTodoResult } from './parsed-todo.mapper';

export class AiService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getAiUsage = async (signal?: AbortSignal): Promise<Result<AiUsage, ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/usage', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = aiUsageResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid getAiUsage response: ${parsed.error.message}`);
    }

    return ok(toAiUsage(parsed.data));
  };

  parseTodo = async (
    text: string,
    categoryId?: number,
  ): Promise<Result<ParsedTodoResult, ApiError>> => {
    const result = await this.#httpClient.post('v1/ai/parse-todo', {
      text,
      ...(categoryId != null && { categoryId }),
    });

    if (!result.ok) {
      return result;
    }

    const parsed = parseTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid parseTodo response: ${parsed.error.message}`);
    }

    return ok(toParsedTodoResult(parsed.data));
  };

  getReportStatus = async (signal?: AbortSignal): Promise<Result<ReportStatus, ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/reports/status', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = reportStatusResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReportStatus',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[AiService] Invalid getReportStatus response: ${parsed.error.message}`);
    }

    return ok(toReportStatus(parsed.data.status));
  };

  getReports = async (
    params?: GetAiReportsParams,
    signal?: AbortSignal,
  ): Promise<Result<AiReport[], ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/reports', {
      signal,
      params: { type: params?.type, limit: params?.limit },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = aiReportListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReports',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[AiService] Invalid getReports response: ${parsed.error.message}`);
    }

    return ok(parsed.data.reports.map(toAiReport));
  };

  getReportById = async (id: number, signal?: AbortSignal): Promise<Result<AiReport, ApiError>> => {
    const result = await this.#httpClient.get(`v1/ai/reports/${id}`, { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = aiReportResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReportById',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[AiService] Invalid getReportById response: ${parsed.error.message}`);
    }

    return ok(toAiReport(parsed.data.report));
  };

  getSuggestions = async (signal?: AbortSignal): Promise<Result<AiSuggestion[], ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/suggestions', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = suggestionListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getSuggestions',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[AiService] Invalid getSuggestions response: ${parsed.error.message}`);
    }

    return ok(parsed.data.suggestions.map(toAiSuggestion));
  };

  parseMemo = async (
    content: string,
    categoryId: number,
  ): Promise<Result<ParsedMemoResult, ApiError>> => {
    const result = await this.#httpClient.post('v1/ai/parse-memo', {
      content,
      categoryId,
    });

    if (!result.ok) {
      return result;
    }

    const parsed = parseMemoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'parseMemo',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[AiService] Invalid parseMemo response: ${parsed.error.message}`);
    }

    return ok(toParsedMemoResult(parsed.data.data));
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
      this.#logger.error(AI_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'handleSuggestionAction',
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[AiService] Invalid handleSuggestionAction response: ${parsed.error.message}`,
      );
    }

    return ok(toAiSuggestionActionResult(parsed.data));
  };
}

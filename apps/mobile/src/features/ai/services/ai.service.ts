import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  parseMemoResponseSchema,
  reportStatusResponseSchema,
  suggestionActionResponseSchema,
  suggestionListResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  AiReport,
  AiSuggestion,
  AiSuggestionActionInput,
  AiSuggestionActionResult,
  GetAiReportsParams,
  ParsedMemoResult,
  ReportStatus,
} from '../models/ai.model';
import {
  toAiReport,
  toAiSuggestion,
  toAiSuggestionActionResult,
  toParsedMemoResult,
  toReportStatus,
} from './ai.mapper';

export class AiService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getReportStatus = async (signal?: AbortSignal): Promise<Result<ReportStatus, ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/reports/status', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = reportStatusResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error('[AiService] Parse failed', undefined, {
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
      this.#logger.error('[AiService] Parse failed', undefined, {
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
      this.#logger.error('[AiService] Parse failed', undefined, {
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
      this.#logger.error('[AiService] Parse failed', undefined, {
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
      this.#logger.error('[AiService] Parse failed', undefined, {
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
      this.#logger.error('[AiService] Parse failed', undefined, {
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

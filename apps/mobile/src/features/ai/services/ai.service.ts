import {
  type AiReportListResponse,
  type AiReportResponse,
  aiReportListResponseSchema,
  aiReportResponseSchema,
  type ReportStatusResponse,
  reportStatusResponseSchema,
  type SuggestionActionResponse,
  type SuggestionListResponse,
  suggestionActionResponseSchema,
  suggestionListResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  AiReport,
  AiSuggestion,
  AiSuggestionActionInput,
  AiSuggestionActionResult,
  GetAiReportsParams,
  ReportStatus,
} from '../models/ai.model';
import {
  toAiReport,
  toAiSuggestion,
  toAiSuggestionActionResult,
  toReportStatus,
} from './ai.mapper';

export class AiService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getReportStatus = async (): Promise<Result<ReportStatus, ApiError>> => {
    const result = await this.#httpClient.get<ReportStatusResponse>('v1/ai/reports/status');

    if (!result.ok) {
      return result;
    }

    const parsed = reportStatusResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid getReportStatus response: ${parsed.error.message}`);
    }

    return ok(toReportStatus(parsed.data.status));
  };

  getReports = async (params?: GetAiReportsParams): Promise<Result<AiReport[], ApiError>> => {
    const result = await this.#httpClient.get<AiReportListResponse>('v1/ai/reports', {
      params: { type: params?.type, limit: params?.limit },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = aiReportListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid getReports response: ${parsed.error.message}`);
    }

    return ok(parsed.data.reports.map(toAiReport));
  };

  getReportById = async (id: number): Promise<Result<AiReport, ApiError>> => {
    const result = await this.#httpClient.get<AiReportResponse>(`v1/ai/reports/${id}`);

    if (!result.ok) {
      return result;
    }

    const parsed = aiReportResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid getReportById response: ${parsed.error.message}`);
    }

    return ok(toAiReport(parsed.data.report));
  };

  getSuggestions = async (): Promise<Result<AiSuggestion[], ApiError>> => {
    const result = await this.#httpClient.get<SuggestionListResponse>('v1/ai/suggestions');

    if (!result.ok) {
      return result;
    }

    const parsed = suggestionListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AiService] Invalid getSuggestions response: ${parsed.error.message}`);
    }

    return ok(parsed.data.suggestions.map(toAiSuggestion));
  };

  handleSuggestionAction = async (
    suggestionId: number,
    input: AiSuggestionActionInput,
  ): Promise<Result<AiSuggestionActionResult, ApiError>> => {
    const result = await this.#httpClient.patch<SuggestionActionResponse>(
      `v1/ai/suggestions/${suggestionId}`,
      input,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = suggestionActionResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AiService] Invalid handleSuggestionAction response: ${parsed.error.message}`,
      );
    }

    return ok(toAiSuggestionActionResult(parsed.data));
  };
}

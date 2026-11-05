import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  parseMemoResponseSchema,
  reportStatusResponseSchema,
  suggestionActionResponseSchema,
  suggestionListResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import { toFeatureQuota } from '@src/features/subscription/apis/entitlement.mapper';
import { toVoicePlanFromParsedMemo } from '@src/features/voice/apis/voice-plan.mapper';
import { VOICE_LOG_EVENT } from '@src/features/voice/constants/voice-log-events';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { AI_LOG_EVENT } from '../constants/ai-log-events';
import type {
  AiReport,
  AiSuggestion,
  AiSuggestionActionInput,
  AiSuggestionActionResult,
  GetAiReportsParams,
  ParsedMemoPlan,
  ReportStatus,
} from '../domains/ai.model';
import {
  toAiReport,
  toAiSuggestion,
  toAiSuggestionActionResult,
  toReportStatus,
} from './ai.mapper';

// 서버 업체 체인 제한(AI_DEADLINE_PARSE_MEMO_MS 25초)보다 길게 기다려야 앱이 먼저 끊어 차감된 결과를 잃지 않는다
const PARSE_MEMO_TIMEOUT_MS = 30_000;

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
    planId: string,
  ): Promise<Result<ParsedMemoPlan, ApiError>> => {
    const result = await this.#httpClient.post(
      'v1/ai/parse-memo',
      { content, categoryId },
      { timeout: PARSE_MEMO_TIMEOUT_MS },
    );

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

    try {
      return ok({
        plan: toVoicePlanFromParsedMemo(planId, parsed.data),
        featureQuota:
          parsed.data.featureQuota == null ? null : toFeatureQuota(parsed.data.featureQuota),
      });
    } catch (error) {
      this.#logger.error(VOICE_LOG_EVENT.PLAN_MAPPING_FAILED, undefined, {
        method: 'parseMemo',
        zodError: error instanceof Error ? error.message : undefined,
      });
      throw new ParseError('[AiService] Invalid parseMemo plan');
    }
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

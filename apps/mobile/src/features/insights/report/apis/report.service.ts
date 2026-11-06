import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  reportStatusResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { REPORT_LOG_EVENT } from '../constants/report-log-events';
import type { AiReport, GetAiReportsParams, ReportStatus } from '../domains/report.model';
import { toAiReport, toReportStatus } from './report.mapper';

export class ReportService {
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
      this.#logger.error(REPORT_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReportStatus',
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[ReportService] Invalid getReportStatus response: ${parsed.error.message}`,
      );
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
      this.#logger.error(REPORT_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReports',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[ReportService] Invalid getReports response: ${parsed.error.message}`);
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
      this.#logger.error(REPORT_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'getReportById',
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[ReportService] Invalid getReportById response: ${parsed.error.message}`,
      );
    }

    return ok(toAiReport(parsed.data.report));
  };
}

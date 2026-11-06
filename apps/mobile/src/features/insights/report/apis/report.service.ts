import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { REPORT_LOG_EVENT } from '../constants/report-log-events';
import {
  type GetAiReportsParams,
  reportDetailResultSchema,
  reportListResultSchema,
  reportStatusResultSchema,
} from '../schemas/report.schema';

export class ReportService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getReportStatus = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/reports/status', { signal }),
      reportStatusResultSchema,
      (dto) => dto.status,
      '[ReportService] Invalid getReportStatus response',
      this.#logInvalid('getReportStatus'),
    );

  getReports = async (params?: GetAiReportsParams, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/reports', {
        signal,
        params: { type: params?.type, limit: params?.limit },
      }),
      reportListResultSchema,
      (dto) => dto.reports,
      '[ReportService] Invalid getReports response',
      this.#logInvalid('getReports'),
    );

  getReportById = async (id: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/ai/reports/${id}`, { signal }),
      reportDetailResultSchema,
      (dto) => dto.report,
      '[ReportService] Invalid getReportById response',
      this.#logInvalid('getReportById'),
    );

  #logInvalid(method: string) {
    return (zodError: string) =>
      this.#logger.error(REPORT_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, { method, zodError });
  }
}

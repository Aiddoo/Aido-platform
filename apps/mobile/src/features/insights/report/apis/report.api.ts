import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  reportStatusResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { REPORT_LOG_EVENT } from '../constants/report-log-events';
import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';
import { toAiReport, toReportStatus } from './report.mapper';

export class ReportApi {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getReportStatus = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/reports/status', { signal }),
      reportStatusResponseSchema,
      (dto) => toReportStatus(dto.status),
      '[ReportApi] Invalid getReportStatus response',
      this.#logInvalid('getReportStatus'),
    );

  getReports = async (params?: GetAiReportsQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/reports', {
        signal,
        params: { type: params?.type, limit: params?.limit },
      }),
      aiReportListResponseSchema,
      (dto) => dto.reports.map(toAiReport),
      '[ReportApi] Invalid getReports response',
      this.#logInvalid('getReports'),
    );

  getReportById = async (id: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/ai/reports/${id}`, { signal }),
      aiReportResponseSchema,
      (dto) => toAiReport(dto.report),
      '[ReportApi] Invalid getReportById response',
      this.#logInvalid('getReportById'),
    );

  #logInvalid = (method: string) => (zodError: string) =>
    this.#logger.error(REPORT_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, { method, zodError });
}

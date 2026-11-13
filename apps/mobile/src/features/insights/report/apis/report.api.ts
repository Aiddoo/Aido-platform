import {
  aiReportListResponseSchema,
  aiReportResponseSchema,
  reportStatusResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';
import { toAiReport, toReportStatus } from './report.mapper';

export class ReportApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getReportStatus = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/ai/reports/status', { signal }),
      reportStatusResponseSchema,
      (dto) => toReportStatus(dto.status),
      '[ReportApi] Invalid getReportStatus response',
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
    );

  getReportById = async (id: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/ai/reports/${id}`, { signal }),
      aiReportResponseSchema,
      (dto) => toAiReport(dto.report),
      '[ReportApi] Invalid getReportById response',
    );
}

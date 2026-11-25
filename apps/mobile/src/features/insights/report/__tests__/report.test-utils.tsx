import type { AiReport as AiReportDto } from '@aido/api/contracts/ai/v1';
import type { AccessTier } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { createSuggestionListDto } from '@src/features/assistant/suggestion/__tests__/suggestion.fixtures';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createConsentDto } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { createWeeklyAchievementListDto } from '@src/features/insights/achievement/__tests__/achievement.fixtures';
import { createTodoServer } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { createHttpClientStub } from '@src/testing/core';

import { createAiReportDto, createReportStatusDto } from './report.fixtures';

/** 서울 수요일 11월 25일 12:00. 이번 주는 11월 23일(월)~29일(일)이다 */
export const REPORT_NOW = new Date('2026-11-25T03:00:00.000Z');

export const WEEKLY_REPORT = createAiReportDto();
/** 1.16.0 전에 만든 월간 리포트. 날마다의 기록·모두 끝낸 날·주로 끝낸 시간이 없다 */
export const MONTHLY_REPORT = createAiReportDto({
  id: 21,
  type: 'MONTHLY',
  period: 10,
  periodLabel: '10월',
  dateRange: { startDate: '2026-10-01', endDate: '2026-10-31' },
  stats: {
    totalTodos: 80,
    completedTodos: 60,
    completionRate: 75,
    prevCompletionRate: null,
    streakDays: 4,
    perfectDays: null,
  },
  timePatterns: [],
  peakHour: null,
  dailyCompletions: null,
  aiContentSource: 'TEMPLATE',
});

type GetResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

interface ReportServerOptions {
  tier?: AccessTier;
  /** 종류마다 목록 응답. 실패를 보려면 응답을 넘긴다 */
  reports?: { WEEKLY?: AiReportDto[] | GetResponse; MONTHLY?: AiReportDto[] | GetResponse };
  /** path마다 덮어쓰는 GET 응답 */
  get?: Record<string, GetResponse>;
}

function isReportList(reports: AiReportDto[] | GetResponse): reports is AiReportDto[] {
  return Array.isArray(reports);
}

/** 리포트 화면들이 읽는 서버. 기본은 AI 동의를 한 프리미엄 사용자이고 주간·월간 리포트가 하나씩 있다 */
export function createReportHttpClient({
  tier = 'PREMIUM',
  reports = {},
  get = {},
}: ReportServerOptions = {}): jest.Mocked<HttpClient> {
  const { WEEKLY = [WEEKLY_REPORT], MONTHLY = [MONTHLY_REPORT] } = reports;
  const server = createTodoServer({
    get: {
      'v1/entitlements': ok(createEntitlementSnapshotDto({ tier })),
      'v1/auth/consent': ok(
        createConsentDto({
          aiDataSharingDecision: 'AGREED',
          aiDataSharingAgreedAt: '2026-11-01T00:00:00.000Z',
        }),
      ),
      'v1/ai/reports/status': ok({ status: createReportStatusDto() }),
      'v1/weekly-achievements': ok(createWeeklyAchievementListDto()),
      'v1/ai/suggestions': ok(createSuggestionListDto()),
      [`v1/ai/reports/${WEEKLY_REPORT.id}`]: ok({ report: WEEKLY_REPORT }),
      [`v1/ai/reports/${MONTHLY_REPORT.id}`]: ok({ report: MONTHLY_REPORT }),
      ...get,
    },
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (path: string, config?: RequestConfig) => {
    if (path !== 'v1/ai/reports') {
      return server.get(path, config);
    }
    const response = config?.params?.type === 'MONTHLY' ? MONTHLY : WEEKLY;
    if (isReportList(response)) {
      return ok({ reports: response });
    }
    return typeof response === 'function' ? response() : response;
  });
  return httpClient;
}

/** 그 path로 보낸 GET의 query */
export function getRequestParams(httpClient: jest.Mocked<HttpClient>, path: string) {
  return httpClient.get.mock.calls
    .filter(([requestPath]) => requestPath === path)
    .map(([, config]) => config?.params);
}

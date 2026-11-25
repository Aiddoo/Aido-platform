/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail } from '@src/core/errors/result';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import {
  createAnalyticsStub,
  createApiError,
  createRouteParamsFake,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Redirect, router } from 'expo-router';

import ReportDetailRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/reports/[reportId]';
import {
  createReportHttpClient,
  MONTHLY_REPORT,
  REPORT_NOW,
  WEEKLY_REPORT,
} from './report.test-utils';

setupFakeTimersPerTest({ now: REPORT_NOW, doNotFake: ['nextTick'] });

async function renderReportDetail({
  reportId,
  httpClient = createReportHttpClient(),
}: {
  reportId: string;
  httpClient?: ReturnType<typeof createReportHttpClient>;
}) {
  createRouteParamsFake({ reportId });
  const analytics = createAnalyticsStub();
  await renderScreen(<ReportDetailRoute />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  return { httpClient, analytics };
}

async function selectNextBar(chartName: string) {
  await act(async () => {
    await fireEvent(screen.getByRole('adjustable', { name: chartName }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
  });
}

describe('ReportDetailRoute', () => {
  it('주간 리포트는 모두 끝낸 날·날마다·주로 끝낸 시간·코치 칸을 보이고 열 때 한 번 남기며 쓰기 요청을 보내지 않는다', async () => {
    // When
    const { httpClient, analytics } = await renderReportDetail({
      reportId: String(WEEKLY_REPORT.id),
    });

    // Then
    expect(await screen.findByText('모두 끝낸 날')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: '날마다 끝낸 할 일' })).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: '주로 끝낸 시간' })).toBeOnTheScreen();
    expect(screen.getByText('오전 7시에 가장 많이 끝냈어요')).toBeOnTheScreen();
    expect(screen.getByText('카테고리별 분석')).toBeOnTheScreen();
    expect(screen.getByText('AI 코치')).toBeOnTheScreen();
    expect(getTrackedEvents(analytics, 'ai_report_viewed')).toEqual([
      { report_id: WEEKLY_REPORT.id, report_type: 'WEEKLY' },
    ]);
    expect(countGetRequests(httpClient)).toMatchObject({
      [`v1/ai/reports/${WEEKLY_REPORT.id}`]: 1,
    });
    expect(httpClient.post).not.toHaveBeenCalled();
    expect(httpClient.patch).not.toHaveBeenCalled();
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('날마다 기록이 없는 옛 월간 리포트는 그 칸들 없이 통계로 채운 요약을 보인다', async () => {
    // When
    await renderReportDetail({ reportId: String(MONTHLY_REPORT.id) });

    // Then
    expect(await screen.findByText('이번 기간 요약')).toBeOnTheScreen();
    expect(screen.queryByText('모두 끝낸 날')).not.toBeOnTheScreen();
    expect(screen.queryByRole('adjustable', { name: '날마다 끝낸 할 일' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('adjustable', { name: '주로 끝낸 시간' })).not.toBeOnTheScreen();
  });

  it('두 차트는 고른 칸의 값을 보이고 차트마다 처음 고를 때 한 번만 남긴다', async () => {
    // Given
    const { analytics } = await renderReportDetail({ reportId: String(WEEKLY_REPORT.id) });
    await screen.findByText('모두 끝낸 날');

    // When
    await selectNextBar('날마다 끝낸 할 일');
    await selectNextBar('날마다 끝낸 할 일');
    await selectNextBar('주로 끝낸 시간');
    await selectNextBar('주로 끝낸 시간');

    // Then
    expect(screen.getByText('11월 17일 · 3개 중 3개 끝냈어요')).toBeOnTheScreen();
    expect(screen.getByText(/^오전 1시 · 0개 끝냈어요$/)).toBeOnTheScreen();
    expect(getTrackedEvents(analytics, 'ai_report_chart_tapped')).toEqual([
      { chart: 'daily_completions' },
      { chart: 'completion_hours' },
    ]);
  });

  it('지워졌거나 내 것이 아닌 리포트는 찾을 수 없다고 알리고 목록으로 돌아간다', async () => {
    // Given
    await renderReportDetail({
      reportId: '99',
      httpClient: createReportHttpClient({
        get: { 'v1/ai/reports/99': fail(createApiError(ErrorCode.AI_1304)) },
      }),
    });

    // When
    await act(async () => {
      await fireEvent.press(await screen.findByRole('button', { name: '리포트 목록으로' }));
    });

    // Then
    expect(screen.getByText('리포트를 찾을 수 없어요')).toBeOnTheScreen();
    expect(router.dismissTo).toHaveBeenCalledWith('/reports');
  });

  it('숫자가 아닌 리포트 id는 목록으로 돌려보내고 리포트를 묻지 않는다', async () => {
    // When
    const { httpClient } = await renderReportDetail({ reportId: 'latest' });

    // Then
    expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toEqual({ href: '/reports' });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('반복 제안 미리보기의 만들기는 리포트에서 연 수락 시트를, 모두 보기는 제안 화면을 연다', async () => {
    // Given
    await renderReportDetail({ reportId: String(WEEKLY_REPORT.id) });
    const make = await screen.findByRole('button', { name: '반복으로 만들기' });

    // When
    await act(async () => {
      await fireEvent.press(make);
      await fireEvent.press(make);
    });
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '모두 보기' }));
    });

    // Then
    expect(jest.mocked(router.push).mock.calls).toEqual([
      [
        {
          pathname: '/suggestions/[suggestionId]/category',
          params: { suggestionId: 1, source: 'report_preview' },
        },
      ],
      ['/suggestions'],
    ]);
  });
});

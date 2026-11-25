/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import {
  createAnalyticsStub,
  createRouteParamsFake,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, router } from 'expo-router';

import SampleReportRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/reports/sample';
import { createReportHttpClient, REPORT_NOW } from './report.test-utils';

setupFakeTimersPerTest({ now: REPORT_NOW, doNotFake: ['nextTick'] });

async function renderSample({
  params,
  httpClient = createReportHttpClient({ tier: 'FREE' }),
}: {
  params: Record<string, string>;
  httpClient?: ReturnType<typeof createReportHttpClient>;
}) {
  createRouteParamsFake(params);
  const analytics = createAnalyticsStub();
  await renderScreen(<SampleReportRoute />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
  });
  return { httpClient, analytics };
}

describe('SampleReportRoute', () => {
  it('무료는 예시 공지 아래 지난주 예시 리포트를 실제 리포트 없이 보이고 결제 안내를 한 번 남긴다', async () => {
    // When
    const { httpClient, analytics } = await renderSample({
      params: { type: 'WEEKLY', periodsAgo: '1' },
    });

    // Then
    expect(await screen.findByTestId('report-sample-notice')).toBeOnTheScreen();
    expect(await screen.findByText('11월 3주차')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: '날마다 끝낸 할 일' })).toBeOnTheScreen();
    expect(countGetRequests(httpClient)).not.toHaveProperty(['v1/ai/reports']);
    expect(getTrackedEvents(analytics, 'premium_gate_shown')).toEqual([
      { feature: 'ai_report', surface: 'report_sample', presentation: 'inline' },
    ]);
  });

  it('예시 차트는 골라도 리포트 지표를 남기지 않는다', async () => {
    // Given
    const { analytics } = await renderSample({ params: { type: 'WEEKLY', periodsAgo: '2' } });
    const chart = await screen.findByRole('adjustable', { name: '날마다 끝낸 할 일' });

    // When
    await act(async () => {
      await fireEvent(chart, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    });

    // Then
    expect(getTrackedEvents(analytics, 'ai_report_chart_tapped')).toEqual([]);
  });

  it('구독 버튼을 같은 프레임에 두 번 눌러도 리포트 결제 화면을 한 번 연다', async () => {
    // Given
    const { analytics } = await renderSample({ params: { type: 'MONTHLY', periodsAgo: '1' } });
    const subscribe = await screen.findByTestId('report-sample-subscribe');

    // When
    await act(async () => {
      await fireEvent.press(subscribe);
      await fireEvent.press(subscribe);
    });

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'AI_REPORT' },
    });
    expect(getTrackedEvents(analytics, 'premium_gate_cta_tapped')).toHaveLength(1);
  });

  it('프리미엄은 예시 대신 내 리포트 목록으로 보낸다', async () => {
    // When
    await renderSample({
      params: { type: 'WEEKLY', periodsAgo: '1' },
      httpClient: createReportHttpClient({ tier: 'PREMIUM' }),
    });

    // Then
    await waitFor(() =>
      expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toEqual({ href: '/reports' }),
    );
  });

  it('예시 수를 넘는 기간은 목록으로 돌려보낸다', async () => {
    // When
    await renderSample({ params: { type: 'WEEKLY', periodsAgo: '9' } });

    // Then
    expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toEqual({ href: '/reports' });
    expect(screen.queryByTestId('report-sample-notice')).not.toBeOnTheScreen();
  });
});

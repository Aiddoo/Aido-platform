/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { AI_REPORT_PAGE_SIZE } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import {
  createWeeklyAchievementDto,
  createWeeklyAchievementListDto,
} from '@src/features/insights/achievement/__tests__/achievement.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import { ServerError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createRouteParamsFake,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ReportsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/reports/index';
import {
  createReportHttpClient,
  getRequestParams,
  REPORT_NOW,
  WEEKLY_REPORT,
} from './report.test-utils';

setupFakeTimersPerTest({ now: REPORT_NOW, doNotFake: ['nextTick'] });

async function renderReports({
  httpClient = createReportHttpClient(),
  params = {},
}: {
  httpClient?: ReturnType<typeof createReportHttpClient>;
  params?: Record<string, string>;
} = {}) {
  createRouteParamsFake(params);
  const analytics = createAnalyticsStub();
  await renderScreen(<ReportsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  return { httpClient, analytics };
}

const LATEST_DETAIL_HREF = {
  pathname: '/reports/[reportId]',
  params: { reportId: String(WEEKLY_REPORT.id) },
};

describe('ReportsScreen', () => {
  describe('프리미엄', () => {
    it('처음 열면 상태·주간 목록·최근 추세를 한 번씩 받아 최근 리포트를 보인다', async () => {
      // When
      const { httpClient } = await renderReports();

      // Then
      expect(await screen.findByText('15%p 올랐어요')).toBeOnTheScreen();
      expect(screen.getByText('11월 16일 ~ 11월 22일')).toBeOnTheScreen();
      expect(screen.getByText('75%')).toBeOnTheScreen();
      expect(await screen.findByText('다음 리포트 D-5 · 월 오전 6:00')).toBeOnTheScreen();
      expect(countGetRequests(httpClient)).toMatchObject({
        'v1/ai/reports': 1,
        'v1/ai/reports/status': 1,
        'v1/weekly-achievements': 1,
      });
      expect(getRequestParams(httpClient, 'v1/ai/reports')).toEqual([
        { type: 'WEEKLY', limit: AI_REPORT_PAGE_SIZE.DEFAULT },
      ]);
      expect(getRequestParams(httpClient, 'v1/weekly-achievements')).toEqual([
        { year: 2026, cursor: undefined, size: undefined },
      ]);
    });

    it('월간 탭을 누르면 월간 목록만 한 번 더 받아 월간 리포트를 보인다', async () => {
      // Given
      const { httpClient } = await renderReports();
      await screen.findByText('15%p 올랐어요');

      // When
      await act(async () => fireEvent.press(screen.getByRole('tab', { name: '월간' })));

      // Then
      expect(await screen.findByText('10월 1일 ~ 10월 31일')).toBeOnTheScreen();
      expect(screen.queryByText('15%p 올랐어요')).not.toBeOnTheScreen();
      expect(getRequestParams(httpClient, 'v1/ai/reports')).toEqual([
        { type: 'WEEKLY', limit: AI_REPORT_PAGE_SIZE.DEFAULT },
        { type: 'MONTHLY', limit: AI_REPORT_PAGE_SIZE.DEFAULT },
      ]);
    });

    it('지난 리포트는 행마다 보이고 자세히 보기를 같은 프레임에 두 번 눌러도 상세를 한 번 연다', async () => {
      // Given
      const pastReport = { ...WEEKLY_REPORT, id: 10, period: 46 };
      await renderReports({
        httpClient: createReportHttpClient({ reports: { WEEKLY: [WEEKLY_REPORT, pastReport] } }),
      });
      await screen.findByText('지난 리포트');
      const [latestDetail] = screen.getAllByRole('button', { name: '자세히 보기' });
      if (latestDetail == null) {
        throw new Error('최근 리포트의 자세히 보기가 없습니다');
      }

      // When
      await act(async () => {
        await fireEvent.press(latestDetail);
        await fireEvent.press(latestDetail);
      });

      // Then
      expect(screen.getAllByRole('button', { name: '자세히 보기' })).toHaveLength(2);
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(LATEST_DETAIL_HREF);
    });

    it('추세 차트를 처음 고를 때 한 번만 남기고 다시 골라도 더 남기지 않는다', async () => {
      // Given
      const { analytics } = await renderReports({
        httpClient: createReportHttpClient({
          get: {
            'v1/weekly-achievements': ok(
              createWeeklyAchievementListDto({
                items: [
                  createWeeklyAchievementDto(),
                  createWeeklyAchievementDto({
                    id: 46,
                    week: 46,
                    dateRange: { startDate: '2026-11-09', endDate: '2026-11-15' },
                    completedTodos: 8,
                    completionRate: 80,
                  }),
                ],
              }),
            ),
          },
        }),
      });
      const trend = await screen.findByRole('adjustable', { name: /최근 2주 달성률/ });

      // When
      await act(async () => {
        await fireEvent(trend, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      });
      await act(async () => {
        await fireEvent(trend, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      });

      // Then
      expect(getTrackedEvents(analytics, 'ai_report_chart_tapped')).toEqual([
        { chart: 'completion_trend' },
      ]);
    });

    it('리포트가 없으면 이번 주 기록과 첫 리포트까지 남은 날을 보이고 차트를 처음 고를 때 한 번 남긴다', async () => {
      // Given
      const { analytics } = await renderReports({
        httpClient: createReportHttpClient({ reports: { WEEKLY: [] } }),
      });
      const chart = await screen.findByRole('adjustable', { name: '이번 주 내 기록' });

      // When
      await act(async () => {
        await fireEvent(chart, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      });
      await act(async () => {
        await fireEvent(chart, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      });

      // Then
      expect(screen.getByText('5일 뒤에 첫 번째 주간 리포트가 도착해요')).toBeOnTheScreen();
      expect(screen.getByText('11월 24일 · 할 일이 없었어요')).toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'ai_report_chart_tapped')).toEqual([
        { chart: 'this_week_record' },
      ]);
    });

    it('목록을 받지 못하면 다시 시도를 보이고 누르면 다시 받아 리포트를 보인다', async () => {
      // Given
      let isServerDown = true;
      const httpClient = createReportHttpClient({
        reports: {
          WEEKLY: async () => {
            if (isServerDown) {
              throw new ServerError(500);
            }
            return { ok: true, value: { reports: [WEEKLY_REPORT] } };
          },
        },
      });
      await renderReports({ httpClient });
      const retry = await screen.findByRole('button', { name: '다시 시도' });

      // When
      isServerDown = false;
      await act(async () => fireEvent.press(retry));

      // Then
      expect(await screen.findByText('15%p 올랐어요')).toBeOnTheScreen();
    });
  });

  describe('무료', () => {
    it('리포트를 묻지 않고 이번 주 기록 아래 예시 리포트와 구독 버튼을 보인다', async () => {
      // When
      const { httpClient, analytics } = await renderReports({
        httpClient: createReportHttpClient({ tier: 'FREE' }),
      });

      // Then
      expect(await screen.findByTestId('report-sample-latest')).toBeOnTheScreen();
      expect(await screen.findByRole('adjustable', { name: '이번 주 내 기록' })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: '자세히 보기' })).toHaveLength(4);
      expect(countGetRequests(httpClient)).not.toHaveProperty(['v1/ai/reports']);
      expect(countGetRequests(httpClient)).not.toHaveProperty(['v1/ai/reports/status']);
      expect(getTrackedEvents(analytics, 'premium_gate_shown')).toEqual([
        { feature: 'ai_report', surface: 'report_list', presentation: 'inline' },
      ]);
    });

    it('예시 카드를 누르면 그 예시 화면을 열고, 구독을 누르면 리포트 결제 화면을 한 번 연다', async () => {
      // Given
      const { analytics } = await renderReports({
        httpClient: createReportHttpClient({ tier: 'FREE' }),
        params: { type: 'MONTHLY' },
      });
      const [latestSample] = await screen.findAllByRole('button', { name: '자세히 보기' });
      if (latestSample == null) {
        throw new Error('예시 카드의 자세히 보기가 없습니다');
      }

      // When
      await act(async () => fireEvent.press(latestSample));
      await act(async () => {
        await fireEvent.press(screen.getByTestId('report-free-subscribe'));
        await fireEvent.press(screen.getByTestId('report-free-subscribe'));
      });

      // Then
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/reports/sample',
        params: { type: 'MONTHLY', periodsAgo: '1' },
      });
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/paywall',
        params: { feature: 'AI_REPORT' },
      });
      expect(getTrackedEvents(analytics, 'premium_gate_cta_tapped')).toHaveLength(2);
    });

    it('예시 추세 차트는 골라도 리포트 지표를 남기지 않는다', async () => {
      // Given
      const { analytics } = await renderReports({
        httpClient: createReportHttpClient({ tier: 'FREE' }),
      });
      const trend = await screen.findByRole('adjustable', { name: /최근 8주 달성률/ });

      // When
      await act(async () => {
        await fireEvent(trend, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      });

      // Then
      expect(getTrackedEvents(analytics, 'ai_report_chart_tapped')).toEqual([]);
    });
  });

  describe('이번 주 기록은 월요일에 시작하는 주다', () => {
    it.each([
      {
        label: '일요일 밤',
        now: '2026-11-29T14:30:00.000Z',
        firstDay: '11월 23일 · 할 일이 없었어요',
        months: ['2026-11-01'],
      },
      {
        label: '월요일 아침',
        now: '2026-11-29T15:30:00.000Z',
        firstDay: '11월 30일 · 할 일이 없었어요',
        // 12월 칸은 일요일 시작 주로 채워 11월 29일부터라 그 주를 한 달로 덮는다
        months: ['2026-11-29'],
      },
      {
        label: '해가 바뀌는 주',
        now: '2026-12-31T03:00:00.000Z',
        firstDay: '12월 28일 · 할 일이 없었어요',
        months: ['2026-12-27'],
      },
    ])(
      '$label에는 그 주 월요일부터 일요일까지를 덮는 달 칸을 받는다',
      async ({ now, firstDay, months }) => {
        // Given
        jest.setSystemTime(new Date(now));
        const { httpClient } = await renderReports({
          httpClient: createReportHttpClient({ tier: 'FREE' }),
        });
        const chart = await screen.findByRole('adjustable', { name: '이번 주 내 기록' });

        // When
        await act(async () => {
          await fireEvent(chart, 'accessibilityAction', {
            nativeEvent: { actionName: 'increment' },
          });
        });

        // Then
        expect(screen.getByText(firstDay)).toBeOnTheScreen();
        expect(
          getRequestParams(httpClient, 'v1/daily-completions').map((params) => params?.startDate),
        ).toEqual(months);
      },
    );
  });

  it('요금제를 받지 못하면 리포트를 묻지 않고 다시 시도를 보인다', async () => {
    // Given
    const httpClient = createReportHttpClient({
      get: { 'v1/entitlements': async () => Promise.reject(new ServerError(500)) },
    });

    // When
    await renderReports({ httpClient });

    // Then
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
    expect(countGetRequests(httpClient)).not.toHaveProperty(['v1/ai/reports']);
  });
});

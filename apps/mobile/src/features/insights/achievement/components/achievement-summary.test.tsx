import '@src/shared/i18n/init';
import { weeklyAchievementListResponseSchema } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { i18n } from '@src/shared/i18n';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, screen } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { Suspense } from 'react';

import { AchievementSummary } from './achievement-summary';

function createWeeklyAchievements(week = 10) {
  return weeklyAchievementListResponseSchema.parse({
    items: [
      {
        id: 42,
        year: 2026,
        week,
        weekLabel: '3월 2주차',
        dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
        totalTodos: 15,
        completedTodos: 14,
        completionRate: 93.3,
        achievedAt: '2026-03-08T14:30:00.000Z',
      },
    ],
    pagination: { nextCursor: null, hasNext: false, size: 20 },
    summary: { totalWeeks: 1, perfectWeeks: 0, currentStreak: 1, bestStreak: 1, averageRate: 93.3 },
  });
}

async function renderSummary(language: 'ko' | 'en') {
  const weekly = { current: createWeeklyAchievements() };
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/weekly-achievements': async () => ok(weekly.current),
    }),
  );
  const analytics = createAnalyticsStub();
  // 다시 그릴 때 새 요소를 넘겨야 포커스 값을 다시 읽는다
  const createUi = () => (
    <LanguageProvider
      syncStorage={createMemoryObservableSyncStorage()}
      useDeviceLanguage={() => language}
    >
      <Suspense fallback={null}>
        <AchievementSummary />
      </Suspense>
    </LanguageProvider>
  );

  const rendered = await renderScreen(createUi(), {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
  });
  const badgeViews = () =>
    analytics.trackEvent.mock.calls
      .filter(([eventName]) => eventName === 'badge_summary_viewed')
      .map(([, params]) => params?.week_label);
  return {
    weekly,
    badgeViews,
    queryClient: rendered.queryClient,
    rerender: () => rendered.rerender(createUi()),
  };
}

describe('AchievementSummary', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it.each([
    { language: 'ko', certificate: /완료율 93\.3%를 달성하였기에/ },
    { language: 'en', certificate: /achieving a 93\.3% completion rate/ },
  ] as const)('$language 상장 문구의 완료율에 %가 붙는다', async ({ language, certificate }) => {
    // Given
    await renderSummary(language);

    // When
    const text = await screen.findByText(certificate);

    // Then
    expect(text).toBeOnTheScreen();
  });

  it('뒤 탭에서 새 주를 다시 받으면 세지 않고, 보일 때 그 주를 포커스가 오가도 한 번 센다', async () => {
    // Given
    jest.mocked(useIsFocused).mockReturnValue(false);
    const { weekly, badgeViews, queryClient, rerender } = await renderSummary('ko');
    await screen.findByText(/완료율 93\.3%를 달성하였기에/);

    // When
    weekly.current = createWeeklyAchievements(11);
    await act(() => queryClient.refetchQueries());
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender();
    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender();
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender();

    // Then
    expect(badgeViews()).toEqual(['2026-W11']);
  });
});

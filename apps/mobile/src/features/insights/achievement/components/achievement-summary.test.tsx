import '@src/shared/i18n/init';
import { weeklyAchievementListResponseSchema } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { i18n } from '@src/shared/i18n';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import {
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { AchievementSummary } from './achievement-summary';

const weeklyAchievements = weeklyAchievementListResponseSchema.parse({
  items: [
    {
      id: 42,
      year: 2026,
      week: 10,
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

async function renderSummary(language: 'ko' | 'en') {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/weekly-achievements': ok(weeklyAchievements),
    }),
  );

  await renderScreen(
    <LanguageProvider
      syncStorage={createMemoryObservableSyncStorage()}
      useDeviceLanguage={() => language}
    >
      <Suspense fallback={null}>
        <AchievementSummary />
      </Suspense>
    </LanguageProvider>,
    { di: createTestDi({ ports: { httpClient } }), withLocalDate: true },
  );
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
});

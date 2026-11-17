/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import {
  type WeeklyAchievementListResponse,
  weeklyAchievementListResponseSchema,
  weeklyAchievementYearsResponseSchema,
} from '@aido/api';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import AchievementsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/achievements/index';

// 서울 2027-01-04 월요일 09:30. 주간 리마인더가 2026년 53주를 남기고 알림을 보낸 뒤다
setupFakeTimersPerTest({ now: new Date('2027-01-04T00:30:00.000Z'), doNotFake: ['nextTick'] });

const WEEK_RANGES = {
  '2026-53': { startDate: '2026-12-28', endDate: '2027-01-03' },
  '2026-52': { startDate: '2026-12-21', endDate: '2026-12-27' },
  '2025-52': { startDate: '2025-12-22', endDate: '2025-12-28' },
} as const;

function createWeeklyList(weekKeys: ReadonlyArray<keyof typeof WEEK_RANGES>) {
  return weeklyAchievementListResponseSchema.parse({
    items: weekKeys.map((weekKey, index) => {
      const [year, week] = weekKey.split('-').map(Number);
      return {
        id: index + 1,
        year,
        week,
        weekLabel: '',
        dateRange: WEEK_RANGES[weekKey],
        totalTodos: 4,
        completedTodos: 4,
        completionRate: 100,
        achievedAt: '2027-01-04T00:00:00.000Z',
      };
    }),
    pagination: { nextCursor: null, hasNext: false, size: 20 },
    summary: {
      totalWeeks: weekKeys.length,
      perfectWeeks: weekKeys.length,
      currentStreak: weekKeys.length,
      bestStreak: weekKeys.length,
      averageRate: 100,
    },
  });
}

const LISTS_BY_YEAR = new Map<unknown, WeeklyAchievementListResponse>([
  [2026, createWeeklyList(['2026-53', '2026-52'])],
  [2025, createWeeklyList(['2025-52'])],
]);
const EMPTY_LIST = createWeeklyList([]);

async function renderAchievements({
  recordedYears,
  params = {},
}: {
  recordedYears: number[];
  params?: Record<string, string>;
}) {
  createRouteParamsFake(params);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url, config) => {
    if (url === 'v1/auth/me') {
      return ok(createCurrentUserDto());
    }
    if (url === 'v1/weekly-achievements/years') {
      return ok(weeklyAchievementYearsResponseSchema.parse({ years: recordedYears }));
    }
    if (url !== 'v1/weekly-achievements') {
      throw new Error(`정하지 않은 요청: ${url}`);
    }
    return ok(LISTS_BY_YEAR.get(config?.params?.year) ?? EMPTY_LIST);
  });
  await renderScreen(<AchievementsScreen />, {
    di: createTestDi({ ports: { httpClient } }),
    withLocalDate: true,
  });
  const requestedListYears = () =>
    httpClient.get.mock.calls
      .filter(([url]) => url === 'v1/weekly-achievements')
      .map(([, config]) => config?.params?.year);

  return { requestedListYears };
}

describe('달성 배지 화면', () => {
  it('해가 바뀐 월요일에 새해 기록이 없으면 빈 새해 대신 알림 받은 지난해 53주 배지를 연도와 함께 보인다', async () => {
    // Given
    await renderAchievements({ recordedYears: [2026] });

    // When
    const certificate = await screen.findByText(/2026년 12월 5주차\(/);

    // Then
    expect(certificate).toBeOnTheScreen();
    expect(screen.getByText('2026년')).toBeOnTheScreen();
    expect(screen.queryByText(/첫 번째 배지가 여기에 나타나요/)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '이전 연도' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 연도' })).toBeDisabled();
  });

  it('연도 막대는 기록 있는 앞 해로 옮겨 그 해 기록을 묻고, 끝 해에서는 더 가지 않는다', async () => {
    // Given
    const { requestedListYears } = await renderAchievements({ recordedYears: [2026, 2025] });
    await screen.findByText('2026년');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '이전 연도' }));
    const certificate = await screen.findByText(/2025년 12월 4주차\(/);

    // Then
    expect(certificate).toBeOnTheScreen();
    expect(requestedListYears()).toContain(2025);
    expect(screen.getByText('2025년')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '이전 연도' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 연도' })).toBeEnabled();
  });

  it('URL에 기록 없는 해가 있으면 기록 있는 가장 최근 해를 보인다', async () => {
    // Given
    await renderAchievements({ recordedYears: [2026, 2025], params: { year: '2019' } });

    // When
    const certificate = await screen.findByText(/2026년 12월 5주차\(/);

    // Then
    expect(certificate).toBeOnTheScreen();
    expect(screen.getByText('2026년')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '이전 연도' })).toBeEnabled();
  });
});

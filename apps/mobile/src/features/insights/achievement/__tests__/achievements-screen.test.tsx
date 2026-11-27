/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import {
  type WeeklyAchievementListResponse,
  weeklyAchievementListResponseSchema,
  weeklyAchievementYearsResponseSchema,
} from '@aido/api/contracts/weekly-achievement/v1';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { findHostsWithProp } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createSystemShareGatewayStub,
  createTestDi,
  getTrackedEvents,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AchievementsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/achievements/index';

// 서울 2027-01-04 월요일 09:30. 주간 리마인더가 2026년 53주를 남기고 알림을 보낸 뒤다
setupFakeTimersPerTest({ now: new Date('2027-01-04T00:30:00.000Z'), doNotFake: ['nextTick'] });

const WEEK_RANGES = {
  '2026-53': { startDate: '2026-12-28', endDate: '2027-01-03' },
  '2026-52': { startDate: '2026-12-21', endDate: '2026-12-27' },
  '2026-51': { startDate: '2026-12-14', endDate: '2026-12-20' },
  '2025-52': { startDate: '2025-12-22', endDate: '2025-12-28' },
} as const;

function createWeeklyList(
  weekKeys: ReadonlyArray<keyof typeof WEEK_RANGES>,
  nextCursor: number | null = null,
) {
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
    pagination: { nextCursor, hasNext: nextCursor != null, size: 20 },
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
  listsByYear = LISTS_BY_YEAR,
  respondNextPage = () => EMPTY_LIST,
}: {
  recordedYears: number[];
  params?: Record<string, string>;
  listsByYear?: Map<unknown, WeeklyAchievementListResponse>;
  /** 커서를 넘긴 다음 쪽 요청의 응답 */
  respondNextPage?: (cursor: unknown) => WeeklyAchievementListResponse;
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
    if (config?.params?.cursor != null) {
      return ok(respondNextPage(config.params.cursor));
    }
    return ok(listsByYear.get(config?.params?.year) ?? EMPTY_LIST);
  });
  const analytics = createAnalyticsStub();
  const systemShare = createSystemShareGatewayStub();
  await renderScreen(<AchievementsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics, systemShare } }),
    withLocalDate: true,
  });
  const requestedListYears = () =>
    httpClient.get.mock.calls
      .filter(([url]) => url === 'v1/weekly-achievements')
      .map(([, config]) => config?.params?.year);

  return { requestedListYears, httpClient, analytics, systemShare };
}

describe('AchievementsScreen', () => {
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

  it('하루 앞선 일요일 밤에는 아직 2026년 53주라 올해를 보는 것이라 연도 막대를 숨긴다', async () => {
    // Given
    // 서울 2027-01-03 일요일 23:30. 월요일 시작 ISO 주로는 아직 2026년 53주다
    jest.setSystemTime(new Date('2027-01-03T14:30:00.000Z'));

    // When
    const { requestedListYears } = await renderAchievements({ recordedYears: [2026] });
    await screen.findByText(/2026년 12월 5주차\(/);

    // Then
    expect(screen.queryByText('2026년')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '이전 연도' })).not.toBeOnTheScreen();
    expect(new Set(requestedListYears())).toEqual(new Set([2026]));
  });

  it('최근 주 상장 아래 지난 주를 행으로 보이고 목록 끝에 닿으면 다음 쪽을 커서로 한 번 받는다', async () => {
    // Given
    const { httpClient } = await renderAchievements({
      recordedYears: [2026],
      listsByYear: new Map([[2026, createWeeklyList(['2026-53', '2026-52'], 2)]]),
      respondNextPage: () => createWeeklyList(['2026-51']),
    });
    await screen.findByText('2026년 12월 4주차');

    // When
    const [list] = findHostsWithProp('onEndReached');
    await act(async () => list?.props.onEndReached());

    // Then
    expect(await screen.findByText('2026년 12월 3주차')).toBeOnTheScreen();
    expect(
      httpClient.get.mock.calls
        .filter(
          ([url, config]) => url === 'v1/weekly-achievements' && config?.params?.year === 2026,
        )
        .map(([, config]) => config?.params?.cursor),
    ).toEqual([undefined, 2]);
  });

  it('지난 주 행을 누르면 그 주 상장을 열고 한 번 남긴다', async () => {
    // Given
    const { analytics } = await renderAchievements({ recordedYears: [2026] });
    const row = await screen.findByText('2026년 12월 4주차');

    // When
    await act(async () => {
      await fireEvent.press(row);
    });

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/achievements/[year]/[week]',
      params: { year: '2026', week: '52' },
    });
    expect(getTrackedEvents(analytics, 'badge_item_tapped')).toEqual([
      { badge_type: 'perfect', completion_rate: 100, year: 2026, week: 52 },
    ]);
  });

  it('공유하기를 같은 프레임에 두 번 눌러도 상장 그림을 한 번 공유한다', async () => {
    // Given
    const { analytics, systemShare } = await renderAchievements({ recordedYears: [2026] });
    await screen.findByText(/2026년 12월 5주차\(/);
    const share = screen.getByText('공유하기');

    // When
    await act(async () => {
      await fireEvent.press(share);
      await fireEvent.press(share);
    });

    // Then
    await waitFor(() => expect(systemShare.shareImage).toHaveBeenCalledTimes(1));
    expect(getTrackedEvents(analytics, 'badge_share_attempted')).toHaveLength(1);
  });

  it('기록이 하나도 없으면 빈 상장의 지금 시작하기가 피드를 한 번 열고 한 번 남긴다', async () => {
    // Given
    const { analytics } = await renderAchievements({ recordedYears: [] });
    const start = await screen.findByRole('button', { name: '지금 시작하기' });

    // When
    await act(async () => {
      await fireEvent.press(start);
      await fireEvent.press(start);
    });

    // Then
    expect(screen.getByText('배지를 모으면 기록이 쌓여요')).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/feed');
    expect(getTrackedEvents(analytics, 'badge_empty_cta_tapped')).toHaveLength(1);
  });
});

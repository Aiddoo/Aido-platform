/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { getTrackedEvents } from '@src/features/weather/__tests__/weather.test-utils';
import { ServerError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createSystemShareGatewayStub,
  createTestDi,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect } from 'expo-router';

import AchievementDetailRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/achievements/[year]/[week]';
import { createWeeklyAchievementDto } from './achievement.fixtures';

// 서울 2026-11-25 수요일 12:00
setupFakeTimersPerTest({ now: new Date('2026-11-25T03:00:00.000Z'), doNotFake: ['nextTick'] });

const DETAIL_PATH = 'v1/weekly-achievements/2026/47';

async function renderDetail({
  params,
  detail = async () => ok(createWeeklyAchievementDto({ completedTodos: 9, completionRate: 90 })),
}: {
  params: Record<string, string>;
  detail?: () => ReturnType<ReturnType<typeof createHttpClientStub>['get']>;
}) {
  createRouteParamsFake(params);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({ 'v1/auth/me': ok(createCurrentUserDto()), [DETAIL_PATH]: detail }),
  );
  const analytics = createAnalyticsStub();
  const systemShare = createSystemShareGatewayStub();
  await renderScreen(<AchievementDetailRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, systemShare } }),
    withLocalDate: true,
  });
  return { httpClient, analytics, systemShare };
}

describe('AchievementDetailRoute', () => {
  it('그 주의 배지 이름과 상장을 보이고 공유를 같은 프레임에 두 번 눌러도 한 번 공유한다', async () => {
    // Given
    const { analytics, systemShare } = await renderDetail({
      params: { year: '2026', week: '47' },
    });
    expect(await screen.findByText('아깝다 한 끗')).toBeOnTheScreen();
    const share = screen.getByText('공유하기');

    // When
    await act(async () => {
      await fireEvent.press(share);
      await fireEvent.press(share);
    });

    // Then
    expect(screen.getByText(/11월 3주차에/)).toBeOnTheScreen();
    await waitFor(() => expect(systemShare.shareImage).toHaveBeenCalledTimes(1));
    expect(getTrackedEvents(analytics, 'badge_share_attempted')).toHaveLength(1);
    expect(getTrackedEvents(analytics, 'badge_share_attempted')[0]).toEqual({
      badge_type: 'almost',
      year: 2026,
      week: 47,
    });
  });

  it('이미지 공유를 못 하는 기기는 상장을 찍지 않고 알린다', async () => {
    // Given
    const { systemShare } = await renderDetail({ params: { year: '2026', week: '47' } });
    systemShare.isImageShareAvailable.mockResolvedValue(false);
    await screen.findByText('아깝다 한 끗');

    // When
    await act(async () => {
      await fireEvent.press(screen.getByText('공유하기'));
    });

    // Then
    await waitFor(() => expect(systemShare.isImageShareAvailable).toHaveBeenCalledTimes(1));
    expect(systemShare.shareImage).not.toHaveBeenCalled();
  });

  it.each<{ label: string; params: Record<string, string> }>([
    { label: '없는 주차', params: { year: '2026', week: '54' } },
    { label: '숫자가 아닌 연도', params: { year: 'this', week: '47' } },
    { label: '빠진 주차', params: { year: '2026' } },
  ])('$label는 배지 목록으로 돌려보내고 묻지 않는다', async ({ params }) => {
    // When
    const { httpClient } = await renderDetail({ params });

    // Then
    expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toEqual({ href: '/achievements' });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('받지 못하면 상장 틀 안에 다시 시도를 보이고 누르면 다시 받아 보인다', async () => {
    // Given
    let isServerDown = true;
    await renderDetail({
      params: { year: '2026', week: '47' },
      detail: async () => {
        if (isServerDown) {
          throw new ServerError(500);
        }
        return ok(createWeeklyAchievementDto());
      },
    });
    const retry = await screen.findByRole('button', { name: '다시 시도' });

    // When
    isServerDown = false;
    await act(async () => {
      await fireEvent.press(retry);
    });

    // Then
    expect(await screen.findByText('빈틈없는 한 주')).toBeOnTheScreen();
  });
});

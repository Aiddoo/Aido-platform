import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { type ApiError, fail, ok, type Result } from '@src/shared/errors';
import {
  createApiError,
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';

import { createWeatherReportDto } from '../__tests__/weather-report.fixtures';
import { createSeoulLocationStub, createWeatherHttpClient } from '../__tests__/weather.test-utils';
import { WeatherForecastBadge } from './weather-forecast-badge';

jest.unmock('expo-router');

setupFakeTimersPerTest({ now: new Date('2026-11-02T07:00:00.000Z') });

const REPORT_PATH = 'v2/weather';

async function renderFeedWithBadge() {
  // 위치를 확인하는 동안에도 배지는 서버 저장 위치로 리포트를 받는다
  const deviceLocation = createLocationGatewayStub();
  deviceLocation.getPermission.mockReturnValue(new Promise(() => undefined));
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      [REPORT_PATH]: ok(createWeatherReportDto()),
      'v1/auth/preference': ok(createPreferenceDto()),
    }),
  );
  await renderAppRoute(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      'feed/index': () => <WeatherForecastBadge />,
      'notifications/index': () => null,
    },
    { url: '/feed', di: createTestDi({ ports: { httpClient, deviceLocation } }) },
  );
  const reportRequestCount = () =>
    httpClient.get.mock.calls.filter(([url]) => url === REPORT_PATH).length;
  await waitFor(() => expect(reportRequestCount()).toBe(1));
  return { reportRequestCount };
}

interface RenderBadgeOptions {
  report?: Result<unknown, ApiError>;
  deviceLocation?: ReturnType<typeof createLocationGatewayStub>;
}

/** 피드 머리의 배지와, 배지가 여는 날씨 화면 자리 */
async function renderBadge({
  report = ok(createWeatherReportDto()),
  deviceLocation = createSeoulLocationStub(),
}: RenderBadgeOptions = {}) {
  const httpClient = createWeatherHttpClient({ report });
  const route = await renderAppRoute(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      'feed/index': () => <WeatherForecastBadge />,
      'weather/index': () => null,
    },
    { url: '/feed', di: createTestDi({ ports: { httpClient, deviceLocation } }) },
  );
  return { route, httpClient };
}

describe('WeatherForecastBadge', () => {
  it('리포트를 받으면 지금 기온을 보이고 공급자를 접근성 이름으로 밝힌다', async () => {
    // When
    await renderBadge();

    // Then
    expect(
      await screen.findByRole('button', { name: '날씨 보기, 지금 12도, Apple Weather 제공' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('12°')).toBeOnTheScreen();
  });

  it.each([
    {
      name: '위치 권한을 아직 묻지 않은 기기',
      permission: { status: 'undetermined', canAskAgain: true },
    },
    { name: '위치 권한을 거부한 기기', permission: { status: 'denied', canAskAgain: false } },
  ] as const)(
    '$name에는 위치를 등록하지 않고 날씨로 가는 배지만 보인다',
    async ({ permission }) => {
      // Given
      const deviceLocation = createLocationGatewayStub({ permission });

      // When
      const { httpClient } = await renderBadge({ deviceLocation });

      // Then
      expect(await screen.findByRole('button', { name: '날씨' })).toBeOnTheScreen();
      expect(httpClient.put).not.toHaveBeenCalled();
    },
  );

  it('리포트를 받지 못해도 날씨 화면으로 갈 배지를 남긴다', async () => {
    // When
    await renderBadge({
      report: fail(createApiError('WEATHER_1902', { message: '위치 정보가 등록되지 않았어요' })),
    });

    // Then
    expect(await screen.findByRole('button', { name: '날씨' })).toBeOnTheScreen();
  });

  it('배지를 누르면 피드 배지 진입과 누른 시각을 붙여 날씨 화면을 연다', async () => {
    // Given
    const { route } = await renderBadge();
    const badge = await screen.findByRole('button', {
      name: '날씨 보기, 지금 12도, Apple Weather 제공',
    });
    // 배지를 기다리는 동안 가짜 시계가 흘러, 누르는 순간의 시각을 읽는다
    const pressedAt = Date.now();

    // When
    await fireEvent.press(badge);

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/weather'));
    expect(route.getSearchParams()).toEqual({
      entry: 'feed_badge',
      openedAt: String(pressedAt),
    });
  });

  it('보이는 동안은 만료된 리포트를 1분마다 다시 받는다', async () => {
    // Given
    const { reportRequestCount } = await renderFeedWithBadge();

    // When
    await act(() => jest.advanceTimersByTimeAsync(5 * MINUTE_MS));

    // Then
    expect(reportRequestCount()).toBe(6);
  });

  it('다른 화면에 가려진 동안은 다시 받지 않고, 다시 보이면 바로 받는다', async () => {
    // Given
    const { reportRequestCount } = await renderFeedWithBadge();
    await act(async () => router.push('/notifications'));

    // When
    await act(() => jest.advanceTimersByTimeAsync(5 * MINUTE_MS));
    const hiddenCount = reportRequestCount();
    await act(async () => router.back());

    // Then
    expect(hiddenCount).toBe(1);
    await waitFor(() => expect(reportRequestCount()).toBe(2));
  });
});

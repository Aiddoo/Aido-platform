import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { ok } from '@src/shared/errors';
import {
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, waitFor } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';

import { createWeatherReportDto } from '../__tests__/weather-report.fixtures';
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

describe('WeatherForecastBadge', () => {
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

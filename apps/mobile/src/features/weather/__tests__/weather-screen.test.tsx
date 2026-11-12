import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoListResponseDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { type ApiError, ok, type Result } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { act, waitFor } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';

import * as AppLayoutRoute from '../../../../app/(app)/_layout';
import WeatherLayout from '../../../../app/(app)/weather/_layout';
import WeatherScreen from '../../../../app/(app)/weather/index';
import { toWeatherHref } from '../utils/weather-link.view-model';

jest.unmock('expo-router');

describe('WeatherScreen', () => {
  it('리포트를 받는 동안 10일 예보의 할 일 점 조회를 함께 시작한다', async () => {
    // Given
    // 위치를 확인하는 동안에도 화면은 서버 저장 위치로 리포트를 받는다
    const deviceLocation = createLocationGatewayStub();
    deviceLocation.getPermission.mockReturnValue(new Promise(() => undefined));
    const report = Promise.withResolvers<Result<unknown, ApiError>>();
    const completions = Promise.withResolvers<Result<unknown, ApiError>>();
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(
      respondByPath({
        'v2/weather': () => report.promise,
        'v1/daily-completions': () => completions.promise,
        'v1/todos': ok(createTodoListResponseDto({ items: [] })),
        'v1/auth/preference': ok(createPreferenceDto()),
      }),
    );

    // When
    await renderAppRoute(
      { _layout: () => <Stack />, 'weather/index': WeatherScreen },
      {
        url: '/weather',
        di: createTestDi({ ports: { httpClient, deviceLocation } }),
        withLocalDate: true,
      },
    );

    // Then
    await waitFor(() =>
      expect(httpClient.get).toHaveBeenCalledWith('v1/daily-completions', expect.anything()),
    );
    expect(httpClient.get).toHaveBeenCalledWith('v2/weather', expect.anything());
  });

  it('날씨가 Stack에 남은 채 알림으로 다시 열면 다시 세고, 하위 화면에서 돌아오면 세지 않는다', async () => {
    // Given
    const deviceLocation = createLocationGatewayStub();
    deviceLocation.getPermission.mockReturnValue(new Promise(() => undefined));
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(
      respondByPath({
        'v1/auth/me': ok(createCurrentUserDto()),
        'v2/weather': () => new Promise(() => undefined),
        'v1/daily-completions': () => new Promise(() => undefined),
        'v1/todos': ok(createTodoListResponseDto({ items: [] })),
        'v1/auth/preference': ok(createPreferenceDto()),
      }),
    );
    const analytics = createAnalyticsStub();
    await renderAppRoute(
      {
        _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
        '(app)/_layout': AppLayoutRoute,
        '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
        '(app)/(tabs)/feed/index': () => null,
        '(app)/weather/_layout': WeatherLayout,
        '(app)/weather/index': WeatherScreen,
        '(app)/todo/[todoId]/index': () => null,
      },
      {
        url: '/feed',
        di: createTestDi({ ports: { httpClient, deviceLocation, analytics } }),
        withLocalDate: true,
        withOverlay: true,
      },
    );
    // 알림 목적지처럼 누른 시각을 붙인 날씨 링크를 navigate로 연다
    const openWeatherFromNotification = (openedAt: number) =>
      act(() => router.navigate(toWeatherHref({ entry: 'notification', openedAt })));
    const openTodo = () =>
      act(() => router.push({ pathname: '/todo/[todoId]', params: { todoId: 1 } }));

    // When
    await openWeatherFromNotification(1000);
    await openTodo();
    await act(() => router.back());
    await openTodo();
    await openWeatherFromNotification(2000);

    // Then
    await waitFor(() =>
      expect(
        analytics.trackEvent.mock.calls.filter(([eventName]) => eventName === 'weather_opened'),
      ).toEqual([
        ['weather_opened', { entry: 'notification' }],
        ['weather_opened', { entry: 'notification' }],
      ]),
    );
  });
});

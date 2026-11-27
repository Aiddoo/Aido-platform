/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import { LocationUnavailableError } from '@src/core/ports/location-gateway';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoListResponseDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { type ApiError, fail, ok, type Result } from '@src/shared/errors';
import { ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  createTestQueryClient,
  getTrackedEvents,
  respondByPath,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { router, Stack } from 'expo-router';

import * as AppLayoutRoute from '../../../../app/(app)/_layout';
import WeatherLayout from '../../../../app/(app)/weather/_layout';
import WeatherScreen from '../../../../app/(app)/weather/index';
import { locationReadingSchema } from '../domains/location-reading.model';
import { WEATHER_QUERY_KEYS } from '../queries/weather-query-keys';
import { toWeatherHref } from '../schemas/weather-entry-params.schema';
import {
  createSeoulReportDto,
  createTokyoReportDto,
  createWeatherReportDto,
} from './weather-report.fixtures';
import {
  createSeoulLocationStub,
  createWeatherHttpClient,
  renderWeatherScreen,
  REPORT_PATH,
  respondWeather,
  TODOS_PATH,
  WEATHER_NOW,
} from './weather.test-utils';

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
        '(app)/(tabs)/(todos)/feed/index': () => null,
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
      expect(getTrackedEvents(analytics, 'weather_opened')).toEqual([
        { entry: 'notification' },
        { entry: 'notification' },
      ]),
    );
  });

  describe('리포트를 받은 화면', () => {
    setupFakeTimersPerTest({ now: WEATHER_NOW });

    it('지금 날씨와 시간별·10일·상세·대기질 카드를 받은 값으로 보이고 특보가 없으면 특보 카드는 없다', async () => {
      // When
      await renderWeatherScreen();

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(screen.getByText('최고 14° 최저 8°')).toBeOnTheScreen();
      expect(screen.getByLabelText('지금, 12도, 흐림, 강수 확률 10%')).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: '오늘, 흐림, 최고 14도, 최저 8도, 강수 확률 20%' }),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText('습도, 88% 이슬점 11°, 눅눅해요. 빨래는 실내에서 말려요'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('미세먼지 보통, 32 ㎍/㎥')).toBeOnTheScreen();
      expect(screen.getByText('Apple Weather · 오후 3:20 업데이트')).toBeOnTheScreen();
      expect(screen.queryByRole('link', { name: /발표$/ })).not.toBeOnTheScreen();
    });

    it('분 단위 예보와 특보가 있는 지역은 곧 올 비와 가장 심각한 특보를 알리고, 특보를 누르면 원문을 연다', async () => {
      // Given
      const httpClient = createWeatherHttpClient({ report: ok(createTokyoReportDto()) });
      const { analytics, externalLink } = await renderWeatherScreen({ httpClient });

      // When
      await fireEvent.press(
        await screen.findByRole('link', { name: '大雨注意報 · 오후 9:00까지, JMA 발표' }),
      );

      // Then
      expect(screen.getByText('17분 뒤 비가 시작돼요')).toBeOnTheScreen();
      expect(externalLink.openInAppBrowser).toHaveBeenCalledWith('https://example.com/jma');
      expect(getTrackedEvents(analytics, 'weather_alert_opened')).toEqual([
        {
          severity: 'MODERATE',
        },
      ]);
    });

    it('분 단위 예보가 없는 지역은 6시간 안에 비가 오는 첫 시간을 시간 단위로 알린다', async () => {
      // Given
      const httpClient = createWeatherHttpClient({ report: ok(createSeoulReportDto()) });

      // When
      await renderWeatherScreen({ httpClient });

      // Then
      expect(await screen.findByText('오후 4시쯤 비 올 확률 70%')).toBeOnTheScreen();
      expect(screen.queryByText('다음 1시간 강수')).not.toBeOnTheScreen();
    });

    it('대기질을 주지 않는 지역은 대기질 카드를 그리지 않는다', async () => {
      // Given
      const httpClient = createWeatherHttpClient({
        report: ok(createWeatherReportDto({ airQuality: null })),
      });

      // When
      await renderWeatherScreen({ httpClient });

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(await screen.findByText('해와 달')).toBeOnTheScreen();
      expect(screen.queryByText('대기질')).not.toBeOnTheScreen();
    });

    it('만료를 넘긴 리포트는 받은 시각을 함께 알린다', async () => {
      // Given
      // 15:20에 받아 15:21에 만료된 리포트를 15:26에 본다
      const httpClient = createWeatherHttpClient({
        report: ok(createWeatherReportDto({ expiresAt: '2026-11-02T06:21:00.000Z' })),
      });

      // When
      await renderWeatherScreen({ httpClient });

      // Then
      expect(await screen.findByText('6분 전 정보예요')).toBeOnTheScreen();
    });

    it('만료 전 리포트에는 받은 시각 안내를 붙이지 않는다', async () => {
      // When
      await renderWeatherScreen();

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(screen.queryByText(/정보예요$/)).not.toBeOnTheScreen();
    });

    it('화면을 열면 리포트·오늘 할 일·설정을 한 번씩만 받고 열기·위치·브리핑 이벤트를 한 번씩 남긴다', async () => {
      // When
      const { httpClient, analytics } = await renderWeatherScreen();
      await screen.findByLabelText('서울 중구, 지금 12도, 흐림');
      await screen.findByText('아이두 브리핑');
      await screen.findByText('대기질');

      // Then
      expect(getTrackedEvents(analytics, 'weather_opened')).toEqual([{ entry: 'other' }]);
      expect(getTrackedEvents(analytics, 'weather_location_registered')).toEqual([
        { result: 'located' },
      ]);
      expect(getTrackedEvents(analytics, 'weather_briefing_shown')).toEqual([
        { kind: 'no_scheduled_todos' },
      ]);
      expect(countGetRequests(httpClient)[REPORT_PATH]).toBe(1);
      expect(countGetRequests(httpClient)[TODOS_PATH]).toBe(1);
      expect(countGetRequests(httpClient)['v1/auth/preference']).toBe(1);
      expect(httpClient.put.mock.calls.map(([url]) => url)).toEqual(['v2/weather/location']);
    });
  });

  describe('온도 단위', () => {
    setupFakeTimersPerTest({ now: WEATHER_NOW });

    // 기기 지역 설정은 포트가 아니라 SDK 대체(expo-localization mock)라 그 값을 바꿨다가 되돌린다
    const [locale] = getLocales();
    if (locale == null) {
      throw new Error('기기 지역 설정이 없습니다');
    }
    const deviceTemperatureUnit = locale.temperatureUnit;

    afterEach(() => {
      locale.temperatureUnit = deviceTemperatureUnit;
    });

    it('기기 온도 단위가 화씨면 기온을 화씨로 보인다', async () => {
      // Given
      locale.temperatureUnit = 'fahrenheit';

      // When
      await renderWeatherScreen();

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 54도, 흐림')).toBeOnTheScreen();
      expect(screen.getByText('최고 57° 최저 46°')).toBeOnTheScreen();
    });
  });

  describe('리포트 실패', () => {
    setupFakeTimersPerTest({ now: WEATHER_NOW });

    it('공급자 장애면 안내와 다시 시도를 보이고, 다시 시도하면 리포트를 다시 받아 보인다', async () => {
      // Given
      const httpClient = createWeatherHttpClient({
        // 503은 HTTP 어댑터가 서버 코드를 실은 ServerError로 던진다
        report: () =>
          Promise.reject(
            new ServerError(503, {
              serverCode: 'WEATHER_1901',
              details: null,
              requestId: null,
              request: null,
            }),
          ),
      });
      const { analytics } = await renderWeatherScreen({ httpClient });
      // 리포트는 두 번까지 다시 시도한 뒤에 실패를 알린다
      await act(() => jest.advanceTimersByTimeAsync(10 * SECOND_MS));
      expect(await screen.findByText('날씨를 잠시\n불러올 수 없어요')).toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'weather_report_failed')).toEqual([
        {
          cause: 'provider_unavailable',
        },
      ]);
      httpClient.get.mockClear();
      respondWeather(httpClient);

      // When
      await fireEvent.press(screen.getByText('다시 시도'));

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(countGetRequests(httpClient)[REPORT_PATH]).toBe(1);
      expect(screen.queryByText('날씨를 잠시\n불러올 수 없어요')).not.toBeOnTheScreen();
    });

    it('오늘 할 일만 받지 못하면 날씨는 그대로 보이고 브리핑 자리에서만 다시 시도를 안내한다', async () => {
      // Given
      const httpClient = createWeatherHttpClient({
        todos: fail(createApiError('SYS_0001', { status: 500 })),
      });
      await renderWeatherScreen({ httpClient });
      expect(await screen.findByText('오늘 할 일을 불러오지 못했어요')).toBeOnTheScreen();
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      respondWeather(httpClient);

      // When
      await fireEvent.press(screen.getByText('다시 시도'));

      // Then
      expect(await screen.findByText('오늘 시간이 정해진 남은 할 일이 없어요')).toBeOnTheScreen();
      expect(screen.queryByText('오늘 할 일을 불러오지 못했어요')).not.toBeOnTheScreen();
    });
  });

  describe('위치', () => {
    setupFakeTimersPerTest({ now: WEATHER_NOW });

    it('권한을 묻지 않은 기기는 위치를 등록하지 않고 안내를 보이며, 계속을 누르면 권한을 물어 날씨를 보인다', async () => {
      // Given
      const deviceLocation = createSeoulLocationStub();
      deviceLocation.getPermission.mockResolvedValueOnce({
        status: 'undetermined',
        canAskAgain: true,
      });
      const { httpClient, analytics } = await renderWeatherScreen({ deviceLocation });
      expect(await screen.findByText('지금 있는 곳 날씨를 보여드릴게요')).toBeOnTheScreen();
      expect(deviceLocation.requestPermission).not.toHaveBeenCalled();
      expect(httpClient.put).not.toHaveBeenCalled();

      // When
      await fireEvent.press(screen.getByText('계속'));

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(deviceLocation.requestPermission).toHaveBeenCalledTimes(1);
      expect(getTrackedEvents(analytics, 'weather_location_permission_result')).toEqual([
        {
          result: 'granted',
        },
      ]);
      expect(getTrackedEvents(analytics, 'weather_location_registered')).toEqual([
        {
          result: 'located',
        },
      ]);
    });

    it('다시 물을 수 없게 거부한 기기는 설정 열기를 안내하고, 누르면 앱 설정을 연다', async () => {
      // Given
      const deviceLocation = createSeoulLocationStub();
      deviceLocation.getPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
      const { httpClient, externalLink, analytics } = await renderWeatherScreen({
        deviceLocation,
      });
      expect(await screen.findByText('설정에서 위치를 켜주세요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('설정 열기'));

      // Then
      expect(externalLink.openSettings).toHaveBeenCalledTimes(1);
      expect(httpClient.put).not.toHaveBeenCalled();
      expect(getTrackedEvents(analytics, 'weather_location_registered')).toEqual([
        {
          result: 'denied',
        },
      ]);
    });

    it('위치를 읽지 못하면 저장된 위치의 날씨를 보이며 알리고, 다시 시도하면 위치를 다시 읽는다', async () => {
      // Given
      const deviceLocation = createSeoulLocationStub();
      deviceLocation.getCoordinates.mockRejectedValueOnce(new LocationUnavailableError('off'));
      await renderWeatherScreen({ deviceLocation });
      expect(
        await screen.findByText('현재 위치를 찾지 못해 저장된 위치의 날씨를 보여드려요'),
      ).toBeOnTheScreen();
      expect(await screen.findByLabelText('현재 위치, 지금 12도, 흐림')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('다시 시도'));

      // Then
      expect(await screen.findByLabelText('서울 중구, 지금 12도, 흐림')).toBeOnTheScreen();
      expect(
        screen.queryByText('현재 위치를 찾지 못해 저장된 위치의 날씨를 보여드려요'),
      ).not.toBeOnTheScreen();
    });

    it('권한을 확인하지 못해 마지막 위치를 쓰면 마지막 위치라고 알리고, 계속을 누르면 권한을 묻는다', async () => {
      // Given
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(
        WEATHER_QUERY_KEYS.location(),
        locationReadingSchema.parse({
          status: 'located',
          registered: { latitude: 37.5636, longitude: 126.9976, timezone: 'Asia/Seoul' },
          place: { city: '서울', district: '중구' },
          countryCode: 'KR',
          revision: 0,
          isLastKnown: true,
        }),
      );
      const { deviceLocation } = await renderWeatherScreen({ queryClient });
      expect(
        await screen.findByText('위치 권한을 확인하지 못해 마지막 위치의 날씨를 보여드려요'),
      ).toBeOnTheScreen();
      expect(await screen.findByText('마지막 위치 · 중구')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('계속'));

      // Then
      expect(await screen.findByText('현재 위치 · 중구')).toBeOnTheScreen();
      expect(deviceLocation.requestPermission).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText('위치 권한을 확인하지 못해 마지막 위치의 날씨를 보여드려요'),
      ).not.toBeOnTheScreen();
    });
  });
});

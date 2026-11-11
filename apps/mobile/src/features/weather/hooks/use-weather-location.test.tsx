import { updateWeatherLocationSchema } from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';
import {
  type LocationCoordinates,
  LocationUnavailableError,
  type LocationGateway,
} from '@src/core/ports/location-gateway';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLocationGatewayStub,
  createLoggerStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useQuery } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { createSeoulReportDto } from '../__tests__/weather-report.fixtures';
import type { LocationReading } from '../domains/weather-location.model';
import { refetchWeatherLocation } from '../queries/weather-cache';
import { WEATHER_QUERY_KEYS } from '../queries/weather-query-keys';
import {
  useGetWeatherReportQueryOptions,
  useWeatherLocationRevision,
} from '../queries/weather.queries';
import { useWeatherLocation } from './use-weather-location';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const BUSAN = { latitude: 35.1796, longitude: 129.0756 };

function createGrantedGatewayStub(overrides: Partial<jest.Mocked<LocationGateway>> = {}) {
  const gateway = createLocationGatewayStub();
  gateway.getPermission.mockResolvedValue({ isGranted: true, canAskAgain: true });
  gateway.requestPermission.mockResolvedValue({ isGranted: true, canAskAgain: true });
  gateway.recheckPermission.mockResolvedValue({ isGranted: true, canAskAgain: true });
  gateway.getCoordinates.mockResolvedValue(SEOUL);
  gateway.getPlace.mockResolvedValue({
    countryCode: 'KR',
    name: { city: '서울', district: '중구' },
  });
  return Object.assign(gateway, overrides);
}

function setup(gateway: jest.Mocked<LocationGateway>) {
  const httpClient = createHttpClientStub();
  httpClient.put.mockImplementation(async (_url, input) => ({
    ok: true,
    value: { ...updateWeatherLocationSchema.parse(input), timezone: 'Asia/Seoul' },
  }));
  httpClient.get.mockResolvedValue({ ok: true, value: createSeoulReportDto() });
  const logger = createLoggerStub();
  const errorReporter = createErrorReporterStub();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  const di = { httpClient, deviceLocation: gateway, logger, errorReporter, analytics };
  const renderHook = <TResult,>(useHook: () => TResult) =>
    renderScreenHook(useHook, { di, queryClient });
  return { httpClient, queryClient, renderHook, logger, errorReporter, analytics };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function useLocationAndRevision() {
  return { location: useWeatherLocation(), revision: useWeatherLocationRevision() };
}

describe('useWeatherLocation', () => {
  it('권한을 요청할 수 있으면 요청 결과를 기록하고 위치를 등록해 준비 상태가 된다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest
        .fn()
        .mockResolvedValueOnce({ isGranted: false, canAskAgain: true })
        .mockResolvedValue({ isGranted: true, canAskAgain: true }),
    });
    const { renderHook, httpClient, analytics, errorReporter } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation());
    await waitFor(() => expect(result.current.status).toBe('needsPermission'));

    // When
    await act(async () => {
      if (result.current.status === 'needsPermission') {
        await result.current.request();
      }
    });

    // Then
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        isLastKnown: false,
      }),
    );
    expect(httpClient.put).toHaveBeenCalledWith('v2/weather/location', SEOUL, {
      signal: expect.any(AbortSignal),
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('weather_location_permission_result', {
      result: 'granted',
    });
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('다시 물을 수 없게 거부했으면 설정 열기 상태가 되고 오류로 보고하지 않는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue({ isGranted: false, canAskAgain: false }),
    });
    const { renderHook, httpClient, errorReporter } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(httpClient.put).not.toHaveBeenCalled();
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('위치 서비스가 꺼져 있으면 기록만 남기고 위치를 찾지 못한 상태가 된다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getCoordinates: jest.fn().mockRejectedValue(new LocationUnavailableError('off')),
    });
    const { renderHook, httpClient, logger, errorReporter } = setup(gateway);

    // When
    const { result } = await renderHook(() => useLocationAndRevision());

    // Then
    await waitFor(() => expect(result.current.location.status).toBe('unavailable'));
    expect(result.current.revision).toBe(0);
    expect(httpClient.put).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('weather.location-read.failed', {
      reason: 'unavailable',
    });
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('위치 읽기가 시간 초과로 실패하면 한 번 보고하고 좌표는 기록하지 않는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getCoordinates: jest.fn().mockRejectedValue(new Error('Location timeout')),
    });
    const { renderHook, errorReporter, logger } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(expect.any(Error), {
      feature: 'weather_location',
      errorCode: 'WEATHER_LOCATION_UNAVAILABLE',
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('37.5');
  });

  it('위치를 찾지 못한 상태에서 다시 시도하면 위치를 다시 읽어 준비 상태가 된다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getCoordinates: jest
        .fn()
        .mockRejectedValueOnce(new LocationUnavailableError('off'))
        .mockResolvedValue(SEOUL),
    });
    const { renderHook } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    // When
    await act(async () => {
      if (result.current.status === 'unavailable') {
        await result.current.retry();
      }
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('리포트는 위치를 읽기 전에 서버 저장 위치로 먼저 요청하고, 같은 격자면 다시 받지 않는다', async () => {
    // Given
    const coordinates = deferred<LocationCoordinates>();
    const gateway = createGrantedGatewayStub();
    gateway.getCoordinates.mockReturnValue(coordinates.promise);
    const { renderHook, httpClient } = setup(gateway);

    // When
    const { result } = await renderHook(() => ({
      ...useLocationAndRevision(),
      report: useQuery(useGetWeatherReportQueryOptions()),
    }));
    await waitFor(() => expect(result.current.report.isSuccess).toBe(true));
    const getCallsBeforeLocation = httpClient.get.mock.calls.length;
    await act(async () => coordinates.resolve(SEOUL));

    // Then
    expect(getCallsBeforeLocation).toBe(1);
    await waitFor(() => expect(result.current.location.status).toBe('ready'));
    expect(result.current.revision).toBe(0);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it('0.01도 미만으로 움직이면 다시 등록하지 않고, 다른 격자로 옮기면 새 리비전으로 리포트를 다시 받는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub();
    const { renderHook, httpClient, queryClient } = setup(gateway);
    const { result } = await renderHook(() => ({
      ...useLocationAndRevision(),
      report: useQuery(useGetWeatherReportQueryOptions()),
    }));
    await waitFor(() => expect(result.current.location.status).toBe('ready'));
    await waitFor(() => expect(result.current.report.isSuccess).toBe(true));
    const revisionBefore = result.current.revision;

    // When
    gateway.getCoordinates.mockResolvedValueOnce({ latitude: 37.5686, longitude: 126.9976 });
    await act(() => refetchWeatherLocation(queryClient));
    const putCountAfterSmallMove = httpClient.put.mock.calls.length;
    gateway.getCoordinates.mockResolvedValueOnce(BUSAN);
    await act(() => refetchWeatherLocation(queryClient));

    // Then
    expect(putCountAfterSmallMove).toBe(1);
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.revision).toBe(revisionBefore + 1));
  });
});

describe('리포트와 위치 등록의 경쟁', () => {
  it('리포트를 아직 받는 중에 등록이 끝나면 그 리포트를 기다려 비교하고, 같은 격자면 다시 받지 않는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub();
    const { renderHook, httpClient } = setup(gateway);
    const report = deferred<{
      ok: true;
      value: ReturnType<typeof createSeoulReportDto>;
    }>();
    httpClient.get.mockReturnValueOnce(report.promise);

    // When
    const { result } = await renderHook(() => ({
      ...useLocationAndRevision(),
      report: useQuery(useGetWeatherReportQueryOptions()),
    }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(1));
    await act(async () => report.resolve({ ok: true, value: createSeoulReportDto() }));

    // Then
    await waitFor(() => expect(result.current.location.status).toBe('ready'));
    expect(result.current.revision).toBe(0);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
});

describe('리포트 요청의 위치 재등록', () => {
  it('서버가 위치를 잃었다고(WEATHER_1902) 하면 마지막 위치를 한 번 다시 등록하고 다시 받는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub();
    const { renderHook, httpClient } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    httpClient.put.mockClear();
    httpClient.get
      .mockResolvedValueOnce({
        ok: false,
        error: new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404),
      })
      .mockResolvedValueOnce({ ok: true, value: createSeoulReportDto() });

    // When
    const report = await renderHook(() => useQuery(useGetWeatherReportQueryOptions()));

    // Then
    await waitFor(() => expect(report.result.current.isSuccess).toBe(true));
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('다시 등록도 실패하면 처음의 WEATHER_1902를 그대로 돌려 위치 안내를 보여 준다', async () => {
    // Given
    const gateway = createGrantedGatewayStub();
    const { renderHook, httpClient } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    httpClient.get.mockResolvedValue({ ok: false, error: notRegistered });
    httpClient.put.mockResolvedValue({
      ok: false,
      error: new ApiError('SYS_0001', '오류', 400),
    });

    // When
    const report = await renderHook(() => useQuery(useGetWeatherReportQueryOptions()));

    // Then
    await waitFor(() => expect(report.result.current.isError).toBe(true));
    expect(report.result.current.error).toBe(notRegistered);
  });
});

describe('앱을 다시 켠 직후 권한 확인이 늦는 경우', () => {
  const NOT_ASKED = { isGranted: false, canAskAgain: true };
  const previousLocated: LocationReading = {
    status: 'located',
    registered: { ...SEOUL, timezone: 'Asia/Seoul' },
    place: { city: '서울', district: '중구' },
    countryCode: 'KR',
    revision: 0,
  };

  function setupWithPreviousLocation(gateway: jest.Mocked<LocationGateway>) {
    const rendered = setup(gateway);
    rendered.queryClient.setQueryData(WEATHER_QUERY_KEYS.location(), previousLocated, {
      updatedAt: 0,
    });
    return rendered;
  }

  it('직전에 위치를 받았으면 권한을 다시 확인해 허용이면 위치를 새로 읽는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    });
    const { renderHook } = setupWithPreviousLocation(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() => expect(gateway.getCoordinates).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', isLastKnown: false }),
    );
    expect(gateway.recheckPermission).toHaveBeenCalledTimes(1);
  });

  it('다시 확인해도 정해지지 않았으면 직전 위치를 마지막 위치로 보여 주고 권한 창은 띄우지 않는다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue(NOT_ASKED),
      recheckPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    });
    const { renderHook, httpClient } = setupWithPreviousLocation(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        isLastKnown: true,
      }),
    );
    expect(gateway.requestPermission).not.toHaveBeenCalled();
    expect(gateway.getCoordinates).not.toHaveBeenCalled();
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('처음 쓰는 사용자는 다시 확인하지 않고 위치 안내를 보여 준다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    });
    const { renderHook } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() => expect(result.current.status).toBe('needsPermission'));
    expect(gateway.recheckPermission).not.toHaveBeenCalled();
  });

  it('다시 물을 수 없게 거부했으면 직전 위치가 있어도 설정 열기 상태가 된다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue({ isGranted: false, canAskAgain: false }),
    });
    const { renderHook } = setupWithPreviousLocation(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation());

    // Then
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(gateway.recheckPermission).not.toHaveBeenCalled();
  });

  it('마지막 위치를 보여 주는 중에 권한을 허용하면 위치를 새로 읽어 현재 위치로 바뀐다', async () => {
    // Given
    const gateway = createGrantedGatewayStub({
      getPermission: jest.fn().mockResolvedValue(NOT_ASKED),
      recheckPermission: jest.fn().mockResolvedValue(NOT_ASKED),
    });
    const { renderHook } = setupWithPreviousLocation(gateway);
    const { result } = await renderHook(() => useWeatherLocation());
    await waitFor(() => expect(result.current).toMatchObject({ isLastKnown: true }));
    gateway.getPermission.mockResolvedValue({ isGranted: true, canAskAgain: true });

    // When
    await act(async () => {
      if (result.current.status === 'ready' && result.current.isLastKnown) {
        await result.current.request();
      }
    });

    // Then
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', isLastKnown: false }),
    );
    expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
  });
});

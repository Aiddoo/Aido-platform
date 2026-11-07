import { updateWeatherLocationSchema } from '@aido/api';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { ApiError } from '@src/core/errors/api-error';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  type LocationCoordinates,
  LocationUnavailableError,
  type LocationGateway,
} from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import {
  createAnalyticsStub,
  createTestDiContainer,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createSeoulReportDto } from '../__tests__/weather-report.fixtures';
import { WeatherLocationService } from '../apis/weather-location.service';
import { WeatherService } from '../apis/weather.service';
import { refetchWeatherLocation } from '../queries/weather-cache';
import {
  useGetWeatherReportQueryOptions,
  useWeatherLocationRevision,
} from '../queries/weather.queries';
import { useWeatherLocation } from './use-weather-location';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const BUSAN = { latitude: 35.1796, longitude: 129.0756 };

function createGateway(overrides: Partial<jest.Mocked<LocationGateway>> = {}) {
  const gateway: jest.Mocked<LocationGateway> = {
    getPermission: jest.fn().mockResolvedValue({ isGranted: true, canAskAgain: true }),
    requestPermission: jest.fn().mockResolvedValue({ isGranted: true, canAskAgain: true }),
    getCoordinates: jest.fn().mockResolvedValue(SEOUL),
    getPlace: jest
      .fn()
      .mockResolvedValue({ countryCode: 'KR', name: { city: '서울', district: '중구' } }),
    ...overrides,
  };
  return gateway;
}

function setup(gateway: jest.Mocked<LocationGateway>) {
  const httpClient = createHttpClientStub();
  httpClient.put.mockImplementation(async (_url, input) => ({
    ok: true,
    value: { ...updateWeatherLocationSchema.parse(input), timezone: 'Asia/Seoul' },
  }));
  httpClient.get.mockResolvedValue({ ok: true, value: createSeoulReportDto() });
  const logger: jest.Mocked<Logger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const errorReporter: jest.Mocked<ErrorReporter> = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  const weatherService = new WeatherService(httpClient);
  const container = createTestDiContainer({
    locationGateway: gateway,
    weatherService,
    weatherLocationService: new WeatherLocationService({
      gateway,
      weatherService,
      logger,
      errorReporter,
    }),
    logger,
    errorReporter,
    analytics,
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    </QueryClientProvider>
  );
  return { httpClient, queryClient, wrapper, logger, errorReporter, analytics };
}

function useLocationAndRevision() {
  return { location: useWeatherLocation(), revision: useWeatherLocationRevision() };
}

describe('useWeatherLocation', () => {
  it('권한을 요청할 수 있으면 요청 결과를 기록하고 위치를 등록해 준비 상태가 된다', async () => {
    // Given
    const gateway = createGateway({
      getPermission: jest
        .fn()
        .mockResolvedValueOnce({ isGranted: false, canAskAgain: true })
        .mockResolvedValue({ isGranted: true, canAskAgain: true }),
    });
    const { httpClient, wrapper, analytics, errorReporter } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
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
    const gateway = createGateway({
      getPermission: jest.fn().mockResolvedValue({ isGranted: false, canAskAgain: false }),
    });
    const { httpClient, wrapper, errorReporter } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });

    // Then
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(httpClient.put).not.toHaveBeenCalled();
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('위치 서비스가 꺼져 있으면 기록만 남기고 위치를 찾지 못한 상태가 된다', async () => {
    // Given
    const gateway = createGateway({
      getCoordinates: jest.fn().mockRejectedValue(new LocationUnavailableError('off')),
    });
    const { httpClient, wrapper, logger, errorReporter } = setup(gateway);

    // When
    const { result } = await renderHook(() => useLocationAndRevision(), { wrapper });

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
    const gateway = createGateway({
      getCoordinates: jest.fn().mockRejectedValue(new Error('Location timeout')),
    });
    const { wrapper, errorReporter, logger } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });

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
    const gateway = createGateway({
      getCoordinates: jest
        .fn()
        .mockRejectedValueOnce(new LocationUnavailableError('off'))
        .mockResolvedValue(SEOUL),
    });
    const { wrapper } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
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
    let resolveCoordinates: (coordinates: LocationCoordinates) => void = () => undefined;
    const gateway = createGateway();
    gateway.getCoordinates.mockImplementation(
      () =>
        new Promise<LocationCoordinates>((resolve) => {
          resolveCoordinates = resolve;
        }),
    );
    const { httpClient, wrapper } = setup(gateway);

    // When
    const { result } = await renderHook(
      () => ({ ...useLocationAndRevision(), report: useQuery(useGetWeatherReportQueryOptions()) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.report.isSuccess).toBe(true));
    const getCallsBeforeLocation = httpClient.get.mock.calls.length;
    await act(async () => resolveCoordinates(SEOUL));

    // Then
    expect(getCallsBeforeLocation).toBe(1);
    await waitFor(() => expect(result.current.location.status).toBe('ready'));
    expect(result.current.revision).toBe(0);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it('0.01도 미만으로 움직이면 다시 등록하지 않고, 다른 격자로 옮기면 새 리비전으로 리포트를 다시 받는다', async () => {
    // Given
    const gateway = createGateway();
    const { httpClient, wrapper, queryClient } = setup(gateway);
    const { result } = await renderHook(
      () => ({ ...useLocationAndRevision(), report: useQuery(useGetWeatherReportQueryOptions()) }),
      { wrapper },
    );
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
    const gateway = createGateway();
    const { httpClient, wrapper } = setup(gateway);
    let resolveReport: (value: { ok: true; value: unknown }) => void = () => undefined;
    httpClient.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReport = resolve;
        }),
    );

    // When
    const { result } = await renderHook(
      () => ({ ...useLocationAndRevision(), report: useQuery(useGetWeatherReportQueryOptions()) }),
      { wrapper },
    );
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(1));
    await act(async () => resolveReport({ ok: true, value: createSeoulReportDto() }));

    // Then
    await waitFor(() => expect(result.current.location.status).toBe('ready'));
    expect(result.current.revision).toBe(0);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
});

describe('리포트 요청의 위치 재등록', () => {
  it('서버가 위치를 잃었다고(WEATHER_1902) 하면 마지막 위치를 한 번 다시 등록하고 다시 받는다', async () => {
    // Given
    const gateway = createGateway();
    const { httpClient, wrapper } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    httpClient.put.mockClear();
    httpClient.get
      .mockResolvedValueOnce({
        ok: false,
        error: new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404),
      })
      .mockResolvedValueOnce({ ok: true, value: createSeoulReportDto() });

    // When
    const report = await renderHook(() => useQuery(useGetWeatherReportQueryOptions()), {
      wrapper,
    });

    // Then
    await waitFor(() => expect(report.result.current.isSuccess).toBe(true));
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('다시 등록도 실패하면 처음의 WEATHER_1902를 그대로 돌려 위치 안내를 보여 준다', async () => {
    // Given
    const gateway = createGateway();
    const { httpClient, wrapper } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    httpClient.get.mockResolvedValue({ ok: false, error: notRegistered });
    httpClient.put.mockResolvedValue({
      ok: false,
      error: new ApiError('SYS_0001', '오류', 400),
    });

    // When
    const report = await renderHook(() => useQuery(useGetWeatherReportQueryOptions()), {
      wrapper,
    });

    // Then
    await waitFor(() => expect(report.result.current.isError).toBe(true));
    expect(report.result.current.error).toBe(notRegistered);
  });
});

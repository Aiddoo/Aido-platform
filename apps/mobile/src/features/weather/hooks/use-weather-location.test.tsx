import { updateWeatherLocationSchema } from '@aido/api';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import { createMockDIContainer, createMockHttpClient } from '@src/shared/__tests__';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { WeatherService } from '../apis/weather.service';
import { refetchWeatherLocation } from '../queries/weather-cache';
import { useWeatherLocation } from './use-weather-location';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };

function createGateway(overrides: Partial<jest.Mocked<LocationGateway>> = {}) {
  const gateway: jest.Mocked<LocationGateway> = {
    getPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    requestPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    getCoordinates: jest.fn().mockResolvedValue(SEOUL),
    getPlace: jest.fn().mockResolvedValue({ countryCode: 'KR', name: '서울 중구' }),
    ...overrides,
  };
  return gateway;
}

function setup(gateway: jest.Mocked<LocationGateway>) {
  const httpClient = createMockHttpClient();
  httpClient.put.mockImplementation(async (_url, input) => ({
    ok: true,
    value: { ...updateWeatherLocationSchema.parse(input), timezone: 'Asia/Seoul' },
  }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = createMockDIContainer({
    locationGateway: gateway,
    weatherService: new WeatherService(httpClient),
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    </QueryClientProvider>
  );
  return { httpClient, queryClient, wrapper };
}

describe('useWeatherLocation', () => {
  it('권한을 요청할 수 있으면 요청 후 위치를 등록하고 준비 상태가 된다', async () => {
    // Given
    const gateway = createGateway({
      getPermission: jest
        .fn()
        .mockResolvedValueOnce({ granted: false, canAskAgain: true })
        .mockResolvedValue({ granted: true, canAskAgain: true }),
    });
    const { httpClient, wrapper, queryClient } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('needsPermission'));

    // When
    await act(async () => {
      if (result.current.status === 'needsPermission') {
        await result.current.request();
      }
    });

    // Then
    expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
    expect(httpClient.put).toHaveBeenCalledWith('v2/weather/location', SEOUL, {
      signal: expect.any(AbortSignal),
    });
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        locationRevision: '37.56,127.00',
        placeName: '서울 중구',
      }),
    );
    queryClient.clear();
  });

  it('다시 물을 수 없게 거부했으면 설정 열기 상태가 된다', async () => {
    // Given
    const gateway = createGateway({
      getPermission: jest.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
    });
    const { httpClient, wrapper, queryClient } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });

    // Then
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(httpClient.put).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('위치를 읽지 못하면 등록 없이 서버에 남은 위치로 날씨를 요청한다', async () => {
    // Given
    const gateway = createGateway({
      getCoordinates: jest.fn().mockRejectedValue(new Error('Location timeout')),
    });
    const { httpClient, wrapper, queryClient } = setup(gateway);

    // When
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });

    // Then
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ locationRevision: 'unlocated' });
    expect(httpClient.put).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('0.01도 미만으로 움직이면 다시 등록하지 않고, 그 이상 움직이면 새 리비전으로 등록한다', async () => {
    // Given
    const gateway = createGateway();
    const { httpClient, wrapper, queryClient } = setup(gateway);
    const { result } = await renderHook(() => useWeatherLocation(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // When
    gateway.getCoordinates.mockResolvedValueOnce({ latitude: 37.5686, longitude: 126.9976 });
    await act(() => refetchWeatherLocation(queryClient));
    const putCountAfterSmallMove = httpClient.put.mock.calls.length;
    gateway.getCoordinates.mockResolvedValueOnce({ latitude: 35.1796, longitude: 129.0756 });
    await act(() => refetchWeatherLocation(queryClient));

    // Then
    expect(putCountAfterSmallMove).toBe(1);
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', locationRevision: '35.18,129.08' }),
    );
    queryClient.clear();
  });
});

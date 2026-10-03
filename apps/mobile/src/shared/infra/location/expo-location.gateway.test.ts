import * as Location from 'expo-location';

import { expoLocationGateway } from './expo-location.gateway';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getLastKnownPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const cachedLocation = jest.mocked(Location.getLastKnownPositionAsync);
const watchLocation = jest.mocked(Location.watchPositionAsync);

describe('위치 구독의 종료와 복구', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cachedLocation.mockResolvedValue(null);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  test('취소 후 늦게 생성된 위치 구독도 제거한다', async () => {
    // Given
    const controller = new AbortController();
    const remove = jest.fn();
    let resolveWatch: ((value: Location.LocationSubscription) => void) | undefined;
    watchLocation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWatch = resolve;
        }),
    );
    const result = expoLocationGateway.getCoordinates(controller.signal);
    const rejection = expect(result).rejects.toThrow('Location cancelled');
    await jest.advanceTimersByTimeAsync(0);

    // When
    controller.abort();
    resolveWatch?.({ remove });
    await rejection;
    await jest.advanceTimersByTimeAsync(0);

    // Then
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('위치가 도착하지 않으면 시간 제한 후 구독을 제거한다', async () => {
    // Given
    const remove = jest.fn();
    watchLocation.mockResolvedValue({ remove });
    const result = expoLocationGateway.getCoordinates(new AbortController().signal);
    const rejection = expect(result).rejects.toThrow('Location timeout');

    // When
    await jest.advanceTimersByTimeAsync(10_001);
    await rejection;

    // Then
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('역지오코딩이 실패해도 위치 흐름을 예외로 종료하지 않는다', async () => {
    // Given
    jest.mocked(Location.reverseGeocodeAsync).mockRejectedValue(new Error('네트워크 오류'));
    const coordinates = { latitude: 37.5, longitude: 127 };

    // When
    const result = await expoLocationGateway.getPlace(coordinates, new AbortController().signal);

    // Then
    expect(result).toEqual({ countryCode: null, name: null });
    expect(jest.getTimerCount()).toBe(0);
  });
});

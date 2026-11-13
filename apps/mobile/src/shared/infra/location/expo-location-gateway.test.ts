import { setupFakeTimersPerTest } from '@src/testing/timers';
import * as Location from 'expo-location';

import { expoLocationGateway } from './expo-location-gateway';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const cachedLocation = jest.mocked(Location.getLastKnownPositionAsync);
const watchLocation = jest.mocked(Location.watchPositionAsync);

describe('위치 구독의 종료와 복구', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    cachedLocation.mockResolvedValue(null);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('취소 후 늦게 생성된 위치 구독도 제거한다', async () => {
    // Given
    const controller = new AbortController();
    const remove = jest.fn();
    const watch = Promise.withResolvers<Location.LocationSubscription>();
    watchLocation.mockReturnValue(watch.promise);
    const result = expoLocationGateway.getCoordinates(controller.signal);
    await jest.advanceTimersByTimeAsync(0);

    // When
    controller.abort();
    watch.resolve({ remove });
    const settling = jest.advanceTimersByTimeAsync(0);

    // Then
    await expect(result).rejects.toThrow('Location cancelled');
    await settling;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(watchLocation).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('위치가 도착하지 않으면 시간 제한 후 구독을 제거한다', async () => {
    // Given
    const remove = jest.fn();
    watchLocation.mockResolvedValue({ remove });
    const result = expoLocationGateway.getCoordinates(new AbortController().signal);

    // When
    const elapsing = jest.advanceTimersByTimeAsync(10_001);

    // Then
    await expect(result).rejects.toThrow('Location timeout');
    await elapsing;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('역지오코딩이 실패해도 위치 흐름을 예외로 종료하지 않는다', async () => {
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

describe('recheckPermission', () => {
  it('Mac이 아니면 권한을 읽기만 하고 요청하지 않는다', async () => {
    // Given
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    // When
    const permission = await expoLocationGateway.recheckPermission();

    // Then
    expect(permission).toEqual({ isGranted: true, canAskAgain: true });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

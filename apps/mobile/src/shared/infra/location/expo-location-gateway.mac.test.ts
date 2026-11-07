import * as Location from 'expo-location';

import { expoLocationGateway } from './expo-location-gateway';

jest.mock('expo-device', () => ({ deviceType: 3, DeviceType: { DESKTOP: 3 } }));

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted' },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

describe('recheckPermission', () => {
  it('Mac에서는 창 없이 허용을 돌려주는 요청 API로 다시 확인한다', async () => {
    // Given
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    // When
    const permission = await expoLocationGateway.recheckPermission();

    // Then
    expect(permission).toEqual({ isGranted: true, canAskAgain: true });
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

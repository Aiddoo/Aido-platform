import * as Notifications from 'expo-notifications';

import { PushTokenService } from './push-token.service';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissionsAsync = jest.mocked(Notifications.requestPermissionsAsync);

describe('PushTokenService.requestPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('이미 허용된 권한은 OS 요청 없이 재사용한다', async () => {
    // Given
    getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    const service = new PushTokenService();

    // When
    const result = await service.requestPermission();

    // Then
    expect(result).toBe(true);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('거부된 권한은 OS 요청을 다시 호출하지 않는다', async () => {
    // Given
    getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const service = new PushTokenService();

    // When
    const result = await service.requestPermission();

    // Then
    expect(result).toBe(false);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('아직 결정되지 않은 권한만 OS에 요청한다', async () => {
    // Given
    getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
    requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    const service = new PushTokenService();

    // When
    const result = await service.requestPermission();

    // Then
    expect(result).toBe(true);
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('호환성 사전 등록은 미결정 권한을 OS에 요청하지 않는다', async () => {
    // Given
    getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
    const service = new PushTokenService();

    // When
    const result = await service.requestPermission(false);

    // Then
    expect(result).toBe(false);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

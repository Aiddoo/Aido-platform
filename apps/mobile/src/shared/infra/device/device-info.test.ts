import { IS_IOS_APP_ON_MAC } from './device-info';

jest.mock('expo-device', () => ({ deviceType: 3, DeviceType: { DESKTOP: 3 } }));

describe('IS_IOS_APP_ON_MAC', () => {
  it('iOS 앱이 데스크톱 기기에서 돌면 Mac이다', () => {
    // Given·When·Then
    expect(IS_IOS_APP_ON_MAC).toBe(true);
  });
});

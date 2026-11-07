import * as Haptics from 'expo-haptics';

import { expoHapticsGateway } from './expo-haptics-gateway';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

const notificationAsync = jest.mocked(Haptics.notificationAsync);

describe('expoHapticsGateway', () => {
  test('알림 햅틱을 지원하지 않는 기기에서 실패해도 예외를 밖으로 내지 않는다', async () => {
    // Given
    notificationAsync.mockRejectedValue(new Error('unsupported'));

    // When
    expoHapticsGateway.notify('error');
    await Promise.resolve();

    // Then
    expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });
});

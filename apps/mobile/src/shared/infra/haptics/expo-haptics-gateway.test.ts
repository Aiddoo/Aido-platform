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
  it('알림 햅틱을 지원하지 않는 기기에서 실패해도 예외를 밖으로 내지 않는다', async () => {
    // Given
    const onUnhandledRejection = jest.fn();
    process.on('unhandledRejection', onUnhandledRejection);
    notificationAsync.mockRejectedValue(new Error('unsupported'));

    // When
    expoHapticsGateway.notify('error');
    // oxlint-disable-next-line aido/no-real-sleep -- 1.15.2 전환 #1400
    await new Promise((resolve) => setImmediate(resolve));

    // Then
    process.off('unhandledRejection', onUnhandledRejection);
    expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    expect(onUnhandledRejection).not.toHaveBeenCalled();
  });
});

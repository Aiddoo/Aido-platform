import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';

import {
  expoPushNotificationGateway,
  PUSH_TOKEN_ISSUE_TIMEOUT_MS,
} from './expo-push-notification.gateway';

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
}));

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const addPushTokenListener = jest.mocked(Notifications.addPushTokenListener);
const getExpoPushTokenAsync = jest.mocked(Notifications.getExpoPushTokenAsync);

describe('expoPushNotificationGateway', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('iOS 임시 허용은 일반 상태와 함께 세부 상태를 그대로 넘긴다', async () => {
    // Given
    getPermissionsAsync.mockResolvedValue({
      status: PermissionStatus.UNDETERMINED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
      ios: {
        status: Notifications.IosAuthorizationStatus.PROVISIONAL,
        allowsDisplayInNotificationCenter: true,
        allowsDisplayOnLockScreen: false,
        allowsDisplayInCarPlay: null,
        allowsAlert: false,
        allowsBadge: true,
        allowsSound: false,
        allowsCriticalAlerts: null,
        alertStyle: 0,
        allowsPreviews: null,
        providesAppNotificationSettings: false,
        allowsAnnouncements: null,
      },
    });

    // When
    const permission = await expoPushNotificationGateway.getPermission();

    // Then
    expect(permission).toEqual({
      status: 'undetermined',
      canAskAgain: true,
      iosStatus: 'PROVISIONAL',
    });
  });

  test('기기 토큰이 같은 값으로 다시 오면 알리지 않고, 해제하면 구독을 지운다', () => {
    // Given
    const remove = jest.fn();
    let emit: Parameters<typeof Notifications.addPushTokenListener>[0] = () => {};
    addPushTokenListener.mockImplementation((listener) => {
      emit = listener;
      return { remove };
    });
    const listener = jest.fn();
    const unsubscribe = expoPushNotificationGateway.addTokenListener(listener);

    // When
    emit({ type: 'ios', data: 'device-token-a' });
    emit({ type: 'ios', data: 'device-token-a' });
    emit({ type: 'ios', data: 'device-token-b' });
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('APNs 등록이 끝나지 않아 토큰 발급이 멈추면 시간 제한 뒤 실패로 끝낸다', async () => {
    // Given 응답하지 않는 발급
    jest.useFakeTimers();
    getExpoPushTokenAsync.mockReturnValue(new Promise(() => {}));
    const issuing = expoPushNotificationGateway.getToken();
    const failure = expect(issuing).rejects.toThrow();

    // When
    await jest.advanceTimersByTimeAsync(PUSH_TOKEN_ISSUE_TIMEOUT_MS);

    // Then
    await failure;
    jest.useRealTimers();
  });
});

import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';

import {
  expoPushNotificationGateway,
  PUSH_TOKEN_ISSUE_TIMEOUT_MS,
} from './expo-push-notification-gateway';

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
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationResponseClearedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
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

  test('알림 응답은 SDK 모양 없이 식별자·버튼·data만 담아 알린다', () => {
    // Given
    const remove = jest.fn();
    let sdkListener: Parameters<
      typeof Notifications.addNotificationResponseReceivedListener
    >[0] = () => {};
    jest
      .mocked(Notifications.addNotificationResponseReceivedListener)
      .mockImplementation((listener) => {
        sdkListener = listener;
        return { remove };
      });
    const listener = jest.fn();

    // When
    const unsubscribe = expoPushNotificationGateway.addResponseListener(listener);
    sdkListener(createSdkResponse({ id: 'req-1', actionIdentifier: 'MARKETING_OPT_OUT' }));
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalledWith({
      id: 'req-1',
      actionIdentifier: 'MARKETING_OPT_OUT',
      data: { notificationId: 1 },
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('앱이 켜진 동안 도착한 알림은 data만 알리고 구독 해제를 돌려준다', () => {
    // Given
    const remove = jest.fn();
    let sdkListener: Parameters<typeof Notifications.addNotificationReceivedListener>[0] = () => {};
    jest.mocked(Notifications.addNotificationReceivedListener).mockImplementation((listener) => {
      sdkListener = listener;
      return { remove };
    });
    const listener = jest.fn();

    // When
    const unsubscribe = expoPushNotificationGateway.addReceivedListener(listener);
    sdkListener(createSdkResponse({ id: 'req-2' }).notification);
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalledWith({ data: { notificationId: 1 } });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('마지막 응답이 없으면 null이고 있으면 같은 DTO로 바꾼다', () => {
    // Given
    const getLast = jest.mocked(Notifications.getLastNotificationResponse);
    getLast.mockReturnValueOnce(null);
    getLast.mockReturnValueOnce(createSdkResponse({ id: 'req-3' }));

    // When
    const none = expoPushNotificationGateway.getLastResponse();
    const last = expoPushNotificationGateway.getLastResponse();

    // Then
    expect(none).toBeNull();
    expect(last).toEqual({
      id: 'req-3',
      actionIdentifier: 'default',
      data: { notificationId: 1 },
    });
  });

  test('마지막 응답 지우기는 SDK에 그대로 넘긴다', () => {
    // Given
    // When
    expoPushNotificationGateway.clearLastResponse();

    // Then
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  test('카테고리는 버튼 제목과 옵션을 SDK 모양으로 바꿔 등록한다', async () => {
    // Given
    jest.mocked(Notifications.setNotificationCategoryAsync).mockResolvedValue({
      identifier: 'MARKETING',
      actions: [],
      options: undefined,
    });

    // When
    await expoPushNotificationGateway.setCategory({
      identifier: 'MARKETING',
      actions: [{ identifier: 'OPT_OUT', title: '수신 거부', opensAppToForeground: true }],
    });

    // Then
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('MARKETING', [
      { identifier: 'OPT_OUT', buttonTitle: '수신 거부', options: { opensAppToForeground: true } },
    ]);
  });
});

function createSdkResponse({
  id,
  actionIdentifier = 'default',
}: {
  id: string;
  actionIdentifier?: string;
}): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: {
      date: 0,
      request: {
        identifier: id,
        content: {
          title: null,
          subtitle: null,
          body: null,
          data: { notificationId: 1 },
          categoryIdentifier: null,
          sound: null,
          threadIdentifier: null,
        },
        trigger: { type: 'unknown' },
      },
    },
  };
}

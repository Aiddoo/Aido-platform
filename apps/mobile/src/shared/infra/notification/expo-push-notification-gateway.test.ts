import { createLoggerStub } from '@src/testing/ports/logger.stub';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { TimeoutError } from 'es-toolkit';
import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';

import {
  createExpoPushNotificationGateway,
  PUSH_TOKEN_ISSUE_TIMEOUT_MS,
  registerForegroundNotificationPresentation,
} from './expo-push-notification-gateway';

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  AndroidImportance: { MAX: 5 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationResponseClearedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const addPushTokenListener = jest.mocked(Notifications.addPushTokenListener);
const getExpoPushTokenAsync = jest.mocked(Notifications.getExpoPushTokenAsync);
const requestPermissionsAsync = jest.mocked(Notifications.requestPermissionsAsync);
const setNotificationChannelAsync = jest.mocked(Notifications.setNotificationChannelAsync);
const setNotificationHandler = jest.mocked(Notifications.setNotificationHandler);

describe('createExpoPushNotificationGateway', () => {
  const gateway = createExpoPushNotificationGateway(createLoggerStub());

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('iOS 임시 허용은 일반 상태와 함께 세부 상태를 그대로 넘긴다', async () => {
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
    const permission = await gateway.getPermission();

    // Then
    expect(permission).toEqual({
      status: 'undetermined',
      canAskAgain: true,
      iosStatus: 'PROVISIONAL',
    });
  });

  it('기기 토큰이 같은 값으로 다시 오면 알리지 않고, 해제하면 구독을 지운다', () => {
    // Given
    const remove = jest.fn();
    let emit: Parameters<typeof Notifications.addPushTokenListener>[0] = () => {};
    addPushTokenListener.mockImplementation((listener) => {
      emit = listener;
      return { remove };
    });
    const listener = jest.fn();
    const unsubscribe = gateway.subscribeToken(listener);

    // When
    emit({ type: 'ios', data: 'device-token-a' });
    emit({ type: 'ios', data: 'device-token-a' });
    emit({ type: 'ios', data: 'device-token-b' });
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  describe('토큰 발급 시간 제한', () => {
    setupFakeTimersPerTest();

    it('APNs 등록이 끝나지 않아 토큰 발급이 멈추면 시간 제한 뒤 실패로 끝낸다', async () => {
      // Given
      // 응답하지 않는 발급
      getExpoPushTokenAsync.mockReturnValue(new Promise(() => {}));
      const issuing = gateway.getToken();

      // When
      const elapsing = jest.advanceTimersByTimeAsync(PUSH_TOKEN_ISSUE_TIMEOUT_MS);

      // Then
      await expect(issuing).rejects.toThrow(TimeoutError);
      await elapsing;
    });
  });

  it('알림 응답은 SDK 모양 없이 식별자·버튼·data만 담아 알린다', () => {
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
    const unsubscribe = gateway.subscribeResponse(listener);
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

  it('앱이 켜진 동안 도착한 알림은 data만 알리고 구독 해제를 돌려준다', () => {
    // Given
    const remove = jest.fn();
    let sdkListener: Parameters<typeof Notifications.addNotificationReceivedListener>[0] = () => {};
    jest.mocked(Notifications.addNotificationReceivedListener).mockImplementation((listener) => {
      sdkListener = listener;
      return { remove };
    });
    const listener = jest.fn();

    // When
    const unsubscribe = gateway.subscribeReceived(listener);
    sdkListener(createSdkResponse({ id: 'req-2' }).notification);
    unsubscribe();

    // Then
    expect(listener).toHaveBeenCalledWith({ data: { notificationId: 1 } });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('마지막 응답이 없으면 null이고 있으면 같은 DTO로 바꾼다', () => {
    // Given
    const getLast = jest.mocked(Notifications.getLastNotificationResponse);
    getLast.mockReturnValueOnce(null);
    getLast.mockReturnValueOnce(createSdkResponse({ id: 'req-3' }));

    // When
    const none = gateway.getLastResponse();
    const last = gateway.getLastResponse();

    // Then
    expect(none).toBeNull();
    expect(last).toEqual({
      id: 'req-3',
      actionIdentifier: 'default',
      data: { notificationId: 1 },
    });
  });

  it('마지막 응답 지우기는 SDK에 그대로 넘긴다', () => {
    // When
    gateway.clearLastResponse();

    // Then
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it('카테고리는 버튼 제목과 옵션을 SDK 모양으로 바꿔 등록한다', async () => {
    // Given
    jest.mocked(Notifications.setNotificationCategoryAsync).mockResolvedValue({
      identifier: 'MARKETING',
      actions: [],
      options: undefined,
    });

    // When
    await gateway.setCategory({
      identifier: 'MARKETING',
      actions: [{ identifier: 'OPT_OUT', title: '수신 거부', opensAppToForeground: true }],
    });

    // Then
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('MARKETING', [
      { identifier: 'OPT_OUT', buttonTitle: '수신 거부', options: { opensAppToForeground: true } },
    ]);
  });
  it('권한 창을 띄우기 전에 알림 채널을 먼저 만든다', async () => {
    // Given
    const order: string[] = [];
    setNotificationChannelAsync.mockImplementation(async () => {
      order.push('channel');
      return null;
    });
    requestPermissionsAsync.mockImplementation(async () => {
      order.push('request');
      return {
        status: PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: false,
        expires: 'never',
      };
    });

    // When
    await gateway.requestPermission();

    // Then
    expect(order).toEqual(['channel', 'request']);
  });

  it('채널을 만들지 못해도 토큰은 받고 실패를 기록한다', async () => {
    // Given
    const logger = createLoggerStub();
    const gatewayWithLogger = createExpoPushNotificationGateway(logger);
    setNotificationChannelAsync.mockRejectedValue(new Error('channel unavailable'));
    getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[abc]' });

    // When
    const token = await gatewayWithLogger.getToken();

    // Then
    expect(token).toBe('ExponentPushToken[abc]');
    expect(logger.warn).toHaveBeenCalledWith('notification.push-channel.setup-failed', {
      error: 'channel unavailable',
    });
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

describe('registerForegroundNotificationPresentation', () => {
  const gateway = createExpoPushNotificationGateway(createLoggerStub());
  const { notification } = createSdkResponse({ id: 'notification-1' });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('화면이 조용히를 고르면 배너·소리 없이 알림 센터에만 남기고, 판단을 거두면 배너로 돌아간다', async () => {
    // Given
    registerForegroundNotificationPresentation();
    const handler = setNotificationHandler.mock.calls[0]?.[0];
    const decide = jest.fn(() => 'quiet' as const);

    // When
    const stopDeciding = gateway.setForegroundPresentation(decide);
    const quiet = await handler?.handleNotification(notification);
    stopDeciding();
    const banner = await handler?.handleNotification(notification);

    // Then
    expect(decide).toHaveBeenCalledWith({ data: { notificationId: 1 } });
    expect(quiet).toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
    expect(banner).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('화면의 판단이 실패해도 알림을 놓치지 않게 배너로 보인다', async () => {
    // Given
    registerForegroundNotificationPresentation();
    const handler = setNotificationHandler.mock.calls[0]?.[0];
    const stopDeciding = gateway.setForegroundPresentation(() => {
      throw new Error('route unavailable');
    });

    // When
    const behavior = await handler?.handleNotification(notification);
    stopDeciding();

    // Then
    expect(behavior?.shouldShowBanner).toBe(true);
  });
});

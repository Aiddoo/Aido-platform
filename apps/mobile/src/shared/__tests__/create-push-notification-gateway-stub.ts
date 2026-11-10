import type {
  ForegroundPushPresentation,
  PushNotificationCategory,
  PushNotificationGateway,
  PushNotificationResponse,
  PushPermissionResponse,
  ReceivedPushNotification,
} from '@src/core/ports/push-notification-gateway';

function grantedPermission(): PushPermissionResponse {
  return { status: 'granted', canAskAgain: false, iosStatus: null };
}

export interface PushNotificationGatewayStub extends jest.Mocked<PushNotificationGateway> {
  /** 앱이 켜진 동안 알림이 도착한 것처럼 구독자에게 알린다 */
  emitReceived(notification: ReceivedPushNotification): void;
  /** 사용자가 알림을 누른 것처럼 구독자에게 알린다. 앱이 꺼진 상태의 마지막 응답으로도 남는다 */
  emitResponse(response: PushNotificationResponse): void;
  /** 앱이 꺼진 상태에서 알림을 눌러 시작한 응답을 정한다 */
  setLastResponse(response: PushNotificationResponse | null): void;
  /** 앱이 앞에 있을 때 이 알림이 오면 어떻게 보일지 정해 둔 판단으로 답한다. 정하지 않았으면 배너다 */
  presentInForeground(notification: ReceivedPushNotification): ForegroundPushPresentation;
  getListenerCount(): number;
}

/** 알림을 허용했고 토큰도 받는 기기가 기본값이다. 테스트마다 다른 부분만 덮어쓴다 */
export function createPushNotificationGatewayStub(
  overrides?: Partial<jest.Mocked<PushNotificationGateway>>,
): PushNotificationGatewayStub {
  const receivedListeners = new Set<(notification: ReceivedPushNotification) => void>();
  const responseListeners = new Set<(response: PushNotificationResponse) => void>();
  let lastResponse: PushNotificationResponse | null = null;
  let decideForegroundPresentation:
    | ((notification: ReceivedPushNotification) => ForegroundPushPresentation)
    | null = null;

  const subscribe = <T>(listeners: Set<T>, listener: T) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getPermission: jest.fn(async () => grantedPermission()),
    requestPermission: jest.fn(async () => grantedPermission()),
    getToken: jest.fn(async () => 'ExponentPushToken[device-123]'),
    subscribeToken: jest.fn((_listener: () => void) => () => {}),
    subscribeReceived: jest.fn((listener: (notification: ReceivedPushNotification) => void) =>
      subscribe(receivedListeners, listener),
    ),
    subscribeResponse: jest.fn((listener: (response: PushNotificationResponse) => void) =>
      subscribe(responseListeners, listener),
    ),
    getLastResponse: jest.fn(() => lastResponse),
    clearLastResponse: jest.fn(() => {
      lastResponse = null;
    }),
    setCategory: jest.fn(async (_category: PushNotificationCategory) => {}),
    setBadgeCount: jest.fn(async (_count: number) => {}),
    setForegroundPresentation: jest.fn(
      (decide: (notification: ReceivedPushNotification) => ForegroundPushPresentation) => {
        decideForegroundPresentation = decide;
        return () => {
          if (decideForegroundPresentation === decide) {
            decideForegroundPresentation = null;
          }
        };
      },
    ),
    emitReceived: (notification) => {
      for (const listener of receivedListeners) {
        listener(notification);
      }
    },
    emitResponse: (response) => {
      lastResponse = response;
      for (const listener of responseListeners) {
        listener(response);
      }
    },
    setLastResponse: (response) => {
      lastResponse = response;
    },
    presentInForeground: (notification) => decideForegroundPresentation?.(notification) ?? 'banner',
    getListenerCount: () => receivedListeners.size + responseListeners.size,
    ...overrides,
  };
}

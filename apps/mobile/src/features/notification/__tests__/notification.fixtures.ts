import type {
  MarkReadResponse,
  NotificationListResponse,
  PushDeviceResponse,
  UnreadCountResponse,
} from '@aido/api';
import type {
  PushNotificationCategory,
  PushNotificationGateway,
  PushNotificationResponse,
  PushPermissionResponse,
  ReceivedPushNotification,
} from '@src/core/ports/push-notification-gateway';
import { ApiError } from '@src/shared/errors/api-error';

import type { PushPermission } from '../domains/push-permission.model';

const generateNotificationListResponseDto = (): NotificationListResponse => ({
  notifications: [
    {
      id: 1,
      userId: 'user-1',
      type: 'FOLLOW_NEW',
      title: '새로운 친구 요청',
      body: '홍길동님이 친구 요청을 보냈어요',
      isRead: false,
      metadata: null,
      context: { friendId: 'friend-1' },
      createdAt: '2026-03-08T10:00:00.000Z',
      readAt: null,
    },
    {
      id: 2,
      userId: 'user-1',
      type: 'TODO_REMINDER',
      title: '할일 리마인더',
      body: '오늘 3개의 할일이 남았어요',
      isRead: true,
      metadata: null,
      context: undefined,
      createdAt: '2026-03-07T09:00:00.000Z',
      readAt: '2026-03-07T10:00:00.000Z',
    },
  ],
  unreadCount: 1,
  hasMore: false,
  nextCursor: null,
});

export const createNotificationListResponseDto = (
  overrides?: Partial<NotificationListResponse>,
): NotificationListResponse => ({
  ...generateNotificationListResponseDto(),
  ...overrides,
});

export const createPushPermission = (overrides?: Partial<PushPermission>): PushPermission => ({
  status: 'GRANTED',
  canAskAgain: false,
  ...overrides,
});

export const createPushPermissionResponse = (
  overrides?: Partial<PushPermissionResponse>,
): PushPermissionResponse => ({
  status: 'granted',
  canAskAgain: false,
  iosStatus: null,
  ...overrides,
});

const generatePushDeviceResponseDto = (): PushDeviceResponse => ({
  deviceId: 'ios_device-123',
  platform: 'IOS',
  permission: { status: 'GRANTED', canAskAgain: false },
  hasActiveToken: true,
  reportedAt: '2026-11-04T03:41:40.598Z',
});

export const createPushDeviceResponseDto = (
  overrides?: Partial<PushDeviceResponse>,
): PushDeviceResponse => ({
  ...generatePushDeviceResponseDto(),
  ...overrides,
});

export interface PushNotificationGatewayStub extends jest.Mocked<PushNotificationGateway> {
  /** 앱이 켜진 동안 알림이 도착한 것처럼 구독자에게 알린다 */
  emitReceived(notification: ReceivedPushNotification): void;
  /** 사용자가 알림을 누른 것처럼 구독자에게 알린다. 앱이 꺼진 상태의 마지막 응답으로도 남는다 */
  emitResponse(response: PushNotificationResponse): void;
  /** 앱이 꺼진 상태에서 알림을 눌러 시작한 응답을 정한다 */
  setLastResponse(response: PushNotificationResponse | null): void;
  getListenerCount(): number;
}

/** 알림을 허용했고 토큰도 받는 기기가 기본값이다. 테스트마다 다른 부분만 덮어쓴다 */
export const createPushNotificationGatewayStub = (
  overrides?: Partial<jest.Mocked<PushNotificationGateway>>,
): PushNotificationGatewayStub => {
  const receivedListeners = new Set<(notification: ReceivedPushNotification) => void>();
  const responseListeners = new Set<(response: PushNotificationResponse) => void>();
  const clearedListeners = new Set<() => void>();
  let lastResponse: PushNotificationResponse | null = null;

  const subscribe = <T>(listeners: Set<T>, listener: T) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getPermission: jest.fn(async () => createPushPermissionResponse()),
    requestPermission: jest.fn(async () => createPushPermissionResponse()),
    ensureChannel: jest.fn(async () => {}),
    getToken: jest.fn(async () => 'ExponentPushToken[device-123]'),
    addTokenListener: jest.fn((_listener: () => void) => () => {}),
    addReceivedListener: jest.fn((listener: (notification: ReceivedPushNotification) => void) =>
      subscribe(receivedListeners, listener),
    ),
    addResponseListener: jest.fn((listener: (response: PushNotificationResponse) => void) =>
      subscribe(responseListeners, listener),
    ),
    addResponseClearedListener: jest.fn((listener: () => void) =>
      subscribe(clearedListeners, listener),
    ),
    getLastResponse: jest.fn(() => lastResponse),
    clearLastResponse: jest.fn(() => {
      lastResponse = null;
      for (const listener of clearedListeners) {
        listener();
      }
    }),
    setCategory: jest.fn(async (_category: PushNotificationCategory) => {}),
    setBadgeCount: jest.fn(async (_count: number) => {}),
    openSettings: jest.fn(async () => {}),
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
    getListenerCount: () => receivedListeners.size + responseListeners.size + clearedListeners.size,
    ...overrides,
  };
};

const generateUnreadCountResponseDto = (): UnreadCountResponse => ({
  unreadCount: 3,
});

export const createUnreadCountResponseDto = (
  overrides?: Partial<UnreadCountResponse>,
): UnreadCountResponse => ({
  ...generateUnreadCountResponseDto(),
  ...overrides,
});

const generateMarkReadResponseDto = (): MarkReadResponse => ({
  message: '읽음 처리되었습니다.',
  readCount: 1,
});

export const createMarkReadResponseDto = (
  overrides?: Partial<MarkReadResponse>,
): MarkReadResponse => ({
  ...generateMarkReadResponseDto(),
  ...overrides,
});

export const createNotificationApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'NOTIFICATION_1001',
    overrides?.message ?? '알림을 찾을 수 없어요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };

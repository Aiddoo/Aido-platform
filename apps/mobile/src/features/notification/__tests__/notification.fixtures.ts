import type { NotificationInboxItem } from '@aido/api/contracts/notification/v1';
import {
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationListResponseSchema,
  pushDeviceResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api/contracts/notification/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { fromEpochMs } from '@src/shared/date/instant';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

import { notificationSchema } from '../domains/notification.model';
import {
  type PushNotificationResponse,
  pushNotificationResponseSchema,
} from '../domains/push-notification-response.model';
import { pushNotificationSchema } from '../domains/push-notification.model';
import { pushPermissionSchema } from '../domains/push-permission.model';
import { pushRegistrationSchema } from '../domains/push-registration.model';

export const createNotificationListResponseDto = defineFixture(notificationListResponseSchema, {
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

/** 넘긴 항목도 서버 계약으로 검증해 받은 응답처럼 만든다 */
export function createNotificationInboxResponseDto(notifications: NotificationInboxItem[]) {
  return notificationInboxResponseSchema.parse({
    notifications,
    unreadCount: 0,
    hasMore: false,
    nextCursor: null,
  });
}

export const createPushPermission = defineFixture(pushPermissionSchema, {
  status: 'GRANTED',
  canAskAgain: false,
});

export function createPushPermissionResponse(
  overrides?: Partial<PushPermissionResponse>,
): PushPermissionResponse {
  return {
    status: 'granted',
    canAskAgain: false,
    iosStatus: null,
    ...overrides,
  };
}

export const createPushDeviceResponseDto = defineFixture(pushDeviceResponseSchema, {
  deviceId: 'ios_device-123',
  platform: 'IOS',
  permission: { status: 'GRANTED', canAskAgain: false },
  hasActiveToken: true,
  reportedAt: '2026-11-04T03:41:40.598Z',
});

export const createUnreadCountResponseDto = defineFixture(unreadCountResponseSchema, {
  unreadCount: 3,
});

export const createMarkReadResponseDto = defineFixture(markReadResponseSchema, {
  message: '읽음 처리되었습니다.',
  readCount: 1,
});

export const createNotification = defineFixture(notificationSchema, {
  id: 1,
  type: 'SYSTEM_NOTICE',
  title: '공지',
  body: '새 기능이 나왔어요',
  isRead: false,
  target: { kind: 'NOTIFICATIONS' },
  receivedCheer: null,
  createdAt: '2026-07-14T00:00:00.000Z',
});

export function createNotificationApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return createApiError(overrides?.code ?? 'NOTIFICATION_1001', {
    message: overrides?.message ?? '알림을 찾을 수 없어요',
    status: overrides?.status ?? 400,
  });
}

export const createPushNotification = defineFixture(pushNotificationSchema, {
  notificationId: 7,
  type: 'FOLLOW_NEW',
  target: { kind: 'FRIEND_REQUESTS' },
  marketingOptOutToken: null,
  actionType: 'DEEP_LINK',
  campaignKey: null,
  variantId: null,
  purpose: null,
});

export const createPushRegistration = defineFixture(pushRegistrationSchema, {
  reportedToken: null,
  releaseRequestedAt: null,
});

/** 상태마다 칸이 달라 넘긴 값까지 모델 스키마로 검증한다 */
export function createPushNotificationResponse(
  overrides: Partial<PushNotificationResponse> = {},
): PushNotificationResponse {
  return pushNotificationResponseSchema.parse({
    id: 'response-1',
    notificationIdentifier: 'notification-request-1',
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: createPushNotification(),
    receivedAt: fromEpochMs(0),
    isLaunchResponse: false,
    appState: 'background',
    activeSince: null,
    ...overrides,
  });
}

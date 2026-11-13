import type {
  NotificationInboxItem,
  NotificationListResponse,
  PushDeviceResponse,
  UnreadCountResponse,
} from '@aido/api';
import {
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationListResponseSchema,
  pushDeviceResponseSchema,
  unreadCountResponseSchema,
  type MarkReadResponse,
} from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { defineFixture } from '@src/testing/fixture';

import { notificationSchema } from '../domains/notification.model';
import type { PushNotificationResponse } from '../domains/push-notification-response.model';
import { pushNotificationSchema } from '../domains/push-notification.model';
import type { PushPermission } from '../domains/push-permission.model';
import { pushRegistrationSchema } from '../domains/push-registration.model';

function generateNotificationListResponseDto(): NotificationListResponse {
  return {
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
  };
}

export function createNotificationListResponseDto(
  overrides?: Partial<NotificationListResponse>,
): NotificationListResponse {
  return notificationListResponseSchema.parse({
    ...generateNotificationListResponseDto(),
    ...overrides,
  });
}

export function createNotificationInboxResponseDto(notifications: NotificationInboxItem[]) {
  return notificationInboxResponseSchema.parse({
    notifications,
    unreadCount: 0,
    hasMore: false,
    nextCursor: null,
  });
}

export function createPushPermission(overrides?: Partial<PushPermission>): PushPermission {
  return {
    status: 'GRANTED',
    canAskAgain: false,
    ...overrides,
  };
}

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

function generatePushDeviceResponseDto(): PushDeviceResponse {
  return {
    deviceId: 'ios_device-123',
    platform: 'IOS',
    permission: { status: 'GRANTED', canAskAgain: false },
    hasActiveToken: true,
    reportedAt: '2026-11-04T03:41:40.598Z',
  };
}

export function createPushDeviceResponseDto(
  overrides?: Partial<PushDeviceResponse>,
): PushDeviceResponse {
  return pushDeviceResponseSchema.parse({ ...generatePushDeviceResponseDto(), ...overrides });
}

function generateUnreadCountResponseDto(): UnreadCountResponse {
  return {
    unreadCount: 3,
  };
}

export function createUnreadCountResponseDto(
  overrides?: Partial<UnreadCountResponse>,
): UnreadCountResponse {
  return unreadCountResponseSchema.parse({ ...generateUnreadCountResponseDto(), ...overrides });
}

function generateMarkReadResponseDto(): MarkReadResponse {
  return {
    message: '읽음 처리되었습니다.',
    readCount: 1,
  };
}

export function createMarkReadResponseDto(overrides?: Partial<MarkReadResponse>): MarkReadResponse {
  return markReadResponseSchema.parse({ ...generateMarkReadResponseDto(), ...overrides });
}

export const createNotification = defineFixture(notificationSchema, {
  id: 1,
  type: 'SYSTEM_NOTICE',
  title: '공지',
  body: '새 기능이 나왔어요',
  isRead: false,
  target: { kind: 'NOTIFICATIONS' },
  receivedCheer: null,
  createdAt: toInstant('2026-07-14T00:00:00.000Z'),
});

export function createNotificationApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'NOTIFICATION_1001',
    overrides?.message ?? '알림을 찾을 수 없어요',
    overrides?.status ?? 400,
  );
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

export function createPushNotificationResponse(
  overrides: Partial<PushNotificationResponse> = {},
): PushNotificationResponse {
  return {
    id: 'response-1',
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: createPushNotification(),
    receivedAt: fromEpochMs(0),
    isLaunchResponse: false,
    appState: 'background',
    activeSince: null,
    ...overrides,
  };
}

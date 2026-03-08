import { ApiError } from '@src/shared/errors/api-error';
import type {
  MarkReadResult,
  NotificationListResponse,
  RegisterTokenResult,
  UnreadCountResult,
} from '../models/notification.model';

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

const generateRegisterTokenResultDto = (): RegisterTokenResult => ({
  message: '푸시 토큰이 등록되었습니다.',
  registered: true,
});

export const createRegisterTokenResultDto = (
  overrides?: Partial<RegisterTokenResult>,
): RegisterTokenResult => ({
  ...generateRegisterTokenResultDto(),
  ...overrides,
});

const generateUnreadCountResultDto = (): UnreadCountResult => ({
  unreadCount: 3,
});

export const createUnreadCountResultDto = (
  overrides?: Partial<UnreadCountResult>,
): UnreadCountResult => ({
  ...generateUnreadCountResultDto(),
  ...overrides,
});

const generateMarkReadResultDto = (): MarkReadResult => ({
  message: '읽음 처리되었습니다.',
  readCount: 1,
});

export const createMarkReadResultDto = (overrides?: Partial<MarkReadResult>): MarkReadResult => ({
  ...generateMarkReadResultDto(),
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

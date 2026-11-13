import type { NotificationInboxItem } from '@aido/api';

import { NAVIGATION_CASES } from '../__tests__/notification-navigation-cases';
import {
  createNotificationInboxResponseDto,
  createNotificationListResponseDto,
} from '../__tests__/notification.fixtures';
import { notificationTargetSchema } from '../domains/notification.model';
import { toNotification, toNotificationPage, toNotificationTarget } from './notification.mapper';

const SENDER_ID = 'cmsender0000000000000001';

function createInboxItemDto(overrides: Partial<NotificationInboxItem> = {}): NotificationInboxItem {
  const [dto] = createNotificationInboxResponseDto([
    {
      id: 1,
      userId: 'user-1',
      type: 'FOLLOW_NEW',
      title: '새로운 친구 요청',
      body: '홍길동님이 친구 요청을 보냈어요',
      isRead: false,
      metadata: null,
      createdAt: '2026-03-08T10:00:00.000Z',
      readAt: null,
      navigation: { kind: 'FRIEND_REQUESTS' },
      ...overrides,
    },
  ]).notifications;
  if (dto == null) {
    throw new Error('Expected notification DTO');
  }
  return dto;
}

describe('toNotification', () => {
  it('createdAt ISO 문자열을 Instant로, 서버 navigation을 target으로 바꾼다', () => {
    // When
    const notification = toNotification(createInboxItemDto());

    // Then
    expect(notification).toEqual({
      id: 1,
      type: 'FOLLOW_NEW',
      title: '새로운 친구 요청',
      body: '홍길동님이 친구 요청을 보냈어요',
      isRead: false,
      target: { kind: 'FRIEND_REQUESTS' },
      receivedCheer: null,
      createdAt: '2026-03-08T10:00:00.000Z',
    });
  });

  it('서버가 navigation을 싣지 못한 항목은 알림함으로 연다', () => {
    // When
    const notification = toNotification(createInboxItemDto({ navigation: undefined }));

    // Then
    expect(notification.target).toEqual({ kind: 'NOTIFICATIONS' });
  });

  it('모르는 metadata(반복 알림 멈춤 stage)가 있어도 목록이 깨지지 않고 navigation대로 연다', () => {
    // When
    const notification = toNotification(
      createInboxItemDto({
        type: 'TODO_REMINDER',
        metadata: { stage: 'series-paused' },
        navigation: { kind: 'TODO', todoId: 42 },
      }),
    );

    // Then
    expect(notification.target).toEqual({
      kind: 'TODO',
      todoId: 42,
      ownerId: null,
      dateKey: null,
    });
  });

  it.each([
    [
      '받은 응원은 신고할 응원과 보낸 친구·이름을 싣는다',
      {
        type: 'CHEER_RECEIVED',
        context: { cheerId: 7, friendId: SENDER_ID },
        metadata: { senderId: SENDER_ID, senderName: '지윤' },
      },
      { cheerId: 7, senderId: SENDER_ID, senderName: '지윤' },
    ],
    [
      '보낸 사람 이름이 없으면 이름 없이 싣는다',
      { type: 'CHEER_RECEIVED', context: { cheerId: 7, friendId: SENDER_ID }, metadata: null },
      { cheerId: 7, senderId: SENDER_ID, senderName: null },
    ],
    [
      '응원 ID가 없으면 신고 대상이 아니다',
      { type: 'CHEER_RECEIVED', context: { friendId: SENDER_ID }, metadata: null },
      null,
    ],
    [
      '응원이 아닌 알림은 신고 대상이 아니다',
      { type: 'NUDGE_RECEIVED', context: { cheerId: 7, friendId: SENDER_ID }, metadata: null },
      null,
    ],
  ] as const)('%s', (_case, overrides, expected) => {
    // When
    const notification = toNotification(createInboxItemDto(overrides));

    // Then
    expect(notification.receivedCheer).toEqual(expected);
  });
});

describe('toNotificationTarget', () => {
  it.each(
    NAVIGATION_CASES.flatMap(({ name, navigation }) =>
      navigation == null ? [] : [{ name, navigation }],
    ),
  )('$name: 서버 navigation과 같은 종류의 앱 target이 된다', ({ navigation }) => {
    // When
    const target = toNotificationTarget(navigation);

    // Then
    expect(target.kind).toBe(navigation.kind);
    expect(notificationTargetSchema.safeParse(target).success).toBe(true);
  });

  it('없는 navigation은 알림함이다', () => {
    // When
    const target = toNotificationTarget(undefined);

    // Then
    expect(target).toEqual({ kind: 'NOTIFICATIONS' });
  });

  it('할 일 주인·날짜는 앱 이름으로 옮기고 없으면 null이다', () => {
    // When
    const withOwner = toNotificationTarget({
      kind: 'TODO_COMMENT',
      todoId: 42,
      todoOwnerId: SENDER_ID,
      todoDate: '2026-11-03',
      commentId: 'cmt92zn3n000b7voxx9quc2th',
      threadCommentId: 'cmt92zn3n000a7voxx9quc2th',
      activityKind: 'REPLY',
    });
    const withoutOwner = toNotificationTarget({ kind: 'TODO', todoId: 42 });

    // Then
    expect(withOwner).toEqual({
      kind: 'TODO_COMMENT',
      todoId: 42,
      ownerId: SENDER_ID,
      dateKey: '2026-11-03',
      commentId: 'cmt92zn3n000b7voxx9quc2th',
    });
    expect(withoutOwner).toEqual({ kind: 'TODO', todoId: 42, ownerId: null, dateKey: null });
  });

  it.each(['BROWSER', 'WEBVIEW'] as const)('외부 링크는 %s로 연다', (presentation) => {
    // When
    const target = toNotificationTarget({
      kind: 'EXTERNAL_URL',
      url: 'https://aido.kr/notice',
      presentation,
    });

    // Then
    expect(target).toEqual({
      kind: 'EXTERNAL_URL',
      url: 'https://aido.kr/notice',
      opensIn: presentation,
    });
  });
});

describe('toNotificationPage', () => {
  it.each([
    { hasMore: true, nextCursor: 5, expected: 5 },
    { hasMore: false, nextCursor: 5, expected: null },
  ])(
    'hasMore $hasMore·커서 $nextCursor이면 다음 커서는 $expected다',
    ({ hasMore, nextCursor, expected }) => {
      // Given
      const dto = createNotificationListResponseDto({ hasMore, nextCursor });

      // When
      const result = toNotificationPage(dto);

      // Then
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe(expected);
    },
  );
});

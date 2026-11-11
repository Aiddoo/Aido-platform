import { setupFakeTimersPerTest } from '@src/testing/timers';

import { createNotificationListResponseDto } from '../__tests__/notification.fixtures';
import { pushNotificationPayloadSchema } from '../schemas/push-notification-payload.schema';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { toNotification, toNotificationPage } from './notification.mapper';

setupFakeTimersPerTest({ now: new Date('2026-03-08T00:00:00.000Z') });

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('toNotification', () => {
  it('createdAt ISO 문자열을 Instant로 바꾼다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.createdAt).toBe('2026-03-08T10:00:00.000Z');
    expect(result.id).toBe(1);
    expect(result.type).toBe('FOLLOW_NEW');
  });

  it('readAt ISO 문자열을 Instant로 바꾼다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[1];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.readAt).toBe('2026-03-07T10:00:00.000Z');
  });

  it('readAt이 null이면 null이다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.readAt).toBeNull();
  });

  it('댓글 metadata는 검증된 routing만 모델에 노출한다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification({
      ...server,
      type: 'TODO_SHARED',
      context: { todoId: 42 },
      metadata: {
        commentId: COMMENT_ID,
        activityKind: 'REPLY',
        senderId: 'sender-1',
        type: 'FOLLOW_ACCEPTED',
        todoId: 999,
      },
    });

    // Then
    expect(result.routing).toEqual({
      commentId: COMMENT_ID,
      activityKind: 'REPLY',
      senderId: 'sender-1',
    });
    expect(result).not.toHaveProperty('metadata');
  });

  it('유효하지 않은 댓글 metadata는 routing으로 승격하지 않는다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification({
      ...server,
      metadata: { commentId: 'not-a-comment-id' },
    });

    // Then
    expect(result.routing).toBeUndefined();
  });
});

describe('toNotificationPage', () => {
  it('알림을 쪽 항목으로 바꾸고 마지막 쪽이면 다음 커서를 비운다', () => {
    // Given
    const dto = createNotificationListResponseDto();

    // When
    const result = toNotificationPage(dto);

    // Then
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.createdAt).toBe('2026-03-08T10:00:00.000Z');
    expect(result.nextCursor).toBeNull();
  });

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
      expect(result.nextCursor).toBe(expected);
    },
  );

  it('빈 배열', () => {
    // Given
    const dto = createNotificationListResponseDto({
      notifications: [],
    });

    // When
    const result = toNotificationPage(dto);

    // Then
    expect(result.items).toEqual([]);
  });
});

describe('pushNotificationPayloadSchema', () => {
  const validData = {
    notificationId: 7,
    type: 'NUDGE_RECEIVED',
    action: { type: 'DEEP_LINK' },
    context: { nudgeId: 3 },
    campaignKey: 'spring',
    unknownField: 'ignored',
  };

  it('계약에 맞는 data는 앱 모델로 읽고 모르는 키는 버린다', () => {
    // Given
    // When
    const result = pushNotificationPayloadSchema.safeParse(validData);

    // Then
    expect(result).toEqual({
      success: true,
      data: {
        notificationId: 7,
        type: 'NUDGE_RECEIVED',
        action: { type: 'DEEP_LINK' },
        context: { nudgeId: 3 },
        campaignKey: 'spring',
      },
    });
  });

  it.each([undefined, { ...validData, context: 'broken' }])(
    '모양이 맞지 않으면 오류를 돌려준다: %j',
    (data) => {
      // Given
      // When
      const result = pushNotificationPayloadSchema.safeParse(data);

      // Then
      expect(result.success).toBe(false);
    },
  );
});

describe('반복 알림이 멈췄다는 안내(TODO_REMINDER, stage: series-paused)', () => {
  it('모르는 stage가 와도 푸시를 읽고 탭하면 그 회차를 연다', () => {
    // Given
    const data = {
      notificationId: 7,
      type: 'TODO_REMINDER',
      action: { type: 'DEEP_LINK' },
      context: { todoId: 42 },
      stage: 'series-paused',
    };

    // When
    const result = pushNotificationPayloadSchema.safeParse(data);

    // Then
    if (!result.success) {
      throw new Error('Expected push payload');
    }
    expect(
      resolveNotificationDestination(result.data, {
        shouldOpenToday: true,
        windowSizeClass: 'compact',
      }),
    ).toEqual({ kind: 'route', href: { pathname: '/todo/[todoId]', params: { todoId: 42 } } });
  });

  it('알림 목록의 metadata에 stage만 있어도 목록이 깨지지 않고 그 회차를 연다', () => {
    // Given
    const [server] = createNotificationListResponseDto().notifications;
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const notification = toNotification({
      ...server,
      type: 'TODO_REMINDER',
      context: { todoId: 42 },
      metadata: { stage: 'series-paused' },
    });

    // Then
    expect(notification.routing).toBeUndefined();
    expect(
      resolveNotificationDestination(notification, {
        shouldOpenToday: true,
        windowSizeClass: 'compact',
      }),
    ).toEqual({ kind: 'route', href: { pathname: '/todo/[todoId]', params: { todoId: 42 } } });
  });
});

describe('pushNotificationPayloadSchema의 navigation·깨진 필드 처리', () => {
  const BASE = { notificationId: 7, type: 'FOLLOW_NEW', action: { type: 'DEEP_LINK' } };

  it('navigation을 앱 모델로 넘긴다', () => {
    // When
    const result = pushNotificationPayloadSchema.safeParse({
      ...BASE,
      navigation: { kind: 'FRIEND_REQUESTS' },
    });

    // Then
    expect(result).toMatchObject({
      success: true,
      data: { navigation: { kind: 'FRIEND_REQUESTS' } },
    });
  });

  it('모르는 타입은 그 필드만 버린다', () => {
    // When
    const result = pushNotificationPayloadSchema.safeParse({ ...BASE, type: 'NEW_KIND' });

    // Then
    expect(result).toMatchObject({ success: true, data: { type: null, notificationId: 7 } });
  });

  it('서버의 새 kind나 틀린 모양의 navigation은 버려 구 필드로 간다', () => {
    // When
    const newKind = pushNotificationPayloadSchema.safeParse({
      ...BASE,
      navigation: { kind: 'NEW_SCREEN' },
    });
    const wrongShape = pushNotificationPayloadSchema.safeParse({
      ...BASE,
      navigation: { kind: 'TODO', todoId: 'x' },
    });

    // Then
    expect(newKind).toMatchObject({ success: true, data: { type: 'FOLLOW_NEW' } });
    expect(newKind.success && newKind.data.navigation).toBeUndefined();
    expect(wrongShape.success && wrongShape.data.navigation).toBeUndefined();
  });

  it('읽음 ID와 액션이 깨져도 탭은 동작한다', () => {
    // When
    const result = pushNotificationPayloadSchema.safeParse({ type: 'FOLLOW_NEW' });

    // Then
    expect(result).toMatchObject({
      success: true,
      data: { notificationId: 0, action: { type: 'DEEP_LINK' } },
    });
  });

  it('dispatchId는 앱 모델에 넣지 않는다', () => {
    // When
    const result = pushNotificationPayloadSchema.safeParse({ ...BASE, dispatchId: 3 });

    // Then
    expect(result.success && 'dispatchId' in result.data).toBe(false);
  });
});

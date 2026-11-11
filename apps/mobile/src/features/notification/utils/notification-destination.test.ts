import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_TYPE } from '@aido/api/vocabulary';

import { createNotificationListResponseDto } from '../__tests__/notification.fixtures';
import { toNotification } from '../apis/notification.mapper';
import type { NotificationContext, NotificationType } from '../domains/notification.model';
import {
  isViewingNotificationDestination,
  type NotificationDestination,
  resolveNotificationDestination,
} from './notification-destination';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const COMPACT = { windowSizeClass: 'compact' } as const;
// 댓글 알림은 할 일 상세 한 화면을 그 댓글 위치로 연다.
const COMMENT_THREAD_DESTINATION = {
  kind: 'route',
  href: { pathname: '/todo/[todoId]', params: { todoId: 42, comment: COMMENT_ID } },
};

describe('resolveNotificationDestination', () => {
  it('댓글 routing은 할 일 상세를 그 댓글 위치로 연다', () => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'TODO_SHARED',
        context: { todoId: 42 },
        routing: { commentId: COMMENT_ID },
        action: { type: 'DEEP_LINK' },
      },
      COMPACT,
    );

    // Then
    expect(result).toEqual(COMMENT_THREAD_DESTINATION);
  });

  it('알림 목록 metadata와 푸시 routing은 같은 댓글 목적지로 해석한다', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }
    const notification = toNotification({
      ...server,
      type: 'TODO_SHARED',
      context: { todoId: 42 },
      metadata: {
        commentId: COMMENT_ID,
        type: 'FOLLOW_ACCEPTED',
        todoId: 999,
      },
    });

    // When
    const fromNotificationList = resolveNotificationDestination(
      {
        type: notification.type,
        context: notification.context,
        routing: notification.routing,
        action: notification.action,
      },
      COMPACT,
    );
    const fromPush = resolveNotificationDestination(
      {
        type: 'TODO_SHARED',
        context: { todoId: 42 },
        routing: { commentId: COMMENT_ID },
        action: { type: 'DEEP_LINK' },
      },
      COMPACT,
    );

    // Then
    expect(fromNotificationList).toEqual(fromPush);
    expect(fromNotificationList).toEqual(COMMENT_THREAD_DESTINATION);
  });

  it('댓글이 없으면 할 일 상세로 이동한다', () => {
    // When
    const result = resolveNotificationDestination(
      { type: 'TODO_SHARED', context: { todoId: 42 } },
      COMPACT,
    );

    // Then
    expect(result).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
  });

  it('이동 재료가 부족한 과거 알림은 이동하지 않는다', () => {
    // When
    const result = resolveNotificationDestination({ type: 'TODO_SHARED' }, COMPACT);

    // Then
    expect(result).toEqual({
      kind: 'none',
    });
  });

  it('NONE 액션은 기본 경로가 있어도 이동하지 않는다', () => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'MORNING_REMINDER',
        action: { type: 'NONE' },
      },
      COMPACT,
    );

    // Then
    expect(result).toEqual({ kind: 'none' });
  });

  it.each([
    ['BROWSER' as const, 'browser'],
    ['WEBVIEW' as const, 'webview'],
  ])('%s 액션을 외부 목적지로 해석한다', (actionType, kind) => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'SYSTEM_NOTICE',
        action: { type: actionType, url: 'https://aido.app/news' },
      },
      COMPACT,
    );

    // Then
    expect(result).toEqual({ kind, url: 'https://aido.app/news' });
  });

  it('웹 주소가 아닌 외부 URL은 열지 않는다', () => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'SYSTEM_NOTICE',
        action: { type: 'BROWSER', url: 'javascript:alert(1)' },
      },
      COMPACT,
    );

    // Then
    expect(result).toEqual({ kind: 'none' });
  });

  it('DEEP_LINK URL 대신 타입과 검증된 재료로 이동한다', () => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'FOLLOW_ACCEPTED',
        context: { friendId: 'friend-1' },
        action: { type: 'DEEP_LINK', url: '/anything/the/server/says' },
      },
      COMPACT,
    );

    // Then
    expect(result).toEqual({
      kind: 'route',
      href: { pathname: '/feed', params: { friendId: 'friend-1' } },
    });
  });

  it('피드 알림은 별도 routing 없이 이동한다', () => {
    // When
    const result = resolveNotificationDestination({ type: 'STREAK_AT_RISK' }, COMPACT);

    // Then
    expect(result).toEqual({
      kind: 'route',
      href: { pathname: '/feed', params: {} },
    });
  });
});

describe('공지 알림의 앱 경로', () => {
  it.each([
    ['/feed', { pathname: '/feed', params: { date: 'today' } }],
    ['/achievements', '/achievements'],
    ['/weather', { pathname: '/weather', params: { entry: 'notification' } }],
    ['/friends', '/friends'],
    ['/friends/invite', { pathname: '/friends/invite' }],
    ['/settings/subscription', { pathname: '/settings/subscription' }],
    ['/settings/notifications', '/settings/notifications'],
  ])('리텐션·운영 공지의 DEEP_LINK %s를 그 화면으로 연다', (url, href) => {
    // When
    const result = resolveNotificationDestination(
      { type: 'SYSTEM_NOTICE', action: { type: 'DEEP_LINK', url } },
      { shouldOpenToday: true, windowSizeClass: 'compact' },
    );

    // Then
    expect(result).toEqual({ kind: 'route', href });
  });

  it.each(Object.values(NOTICE_DEEP_LINK_PATH))(
    '서버가 보낼 수 있는 공지 경로 %s는 모두 연다',
    (url) => {
      // When
      const result = resolveNotificationDestination(
        { type: 'SYSTEM_NOTICE', action: { type: 'DEEP_LINK', url } },
        COMPACT,
      );

      // Then
      expect(result).toMatchObject({ kind: 'route' });
    },
  );

  it.each(['ADMIN_BROADCAST', 'ADMIN_TARGETED'] as const)(
    '%s 공지도 같은 경로 표를 따른다',
    (type) => {
      expect(
        resolveNotificationDestination(
          {
            type,
            action: { type: 'DEEP_LINK', url: '/achievements' },
          },
          COMPACT,
        ),
      ).toEqual({ kind: 'route', href: '/achievements' });
    },
  );

  it.each([
    ['경로가 없는 공지', undefined],
    ['모르는 경로', '/anything/the/server/says'],
    ['상세 id가 필요한 경로', '/todo/42'],
    ['쿼리가 붙은 경로', '/feed?friendId=friend-1'],
    ['앱 스킴 URL', 'aido://feed'],
  ])('%s(%s)는 이동하지 않는다', (_name, url) => {
    // When
    const result = resolveNotificationDestination(
      { type: 'SYSTEM_NOTICE', action: { type: 'DEEP_LINK', url } },
      COMPACT,
    );

    // Then
    expect(result).toEqual({ kind: 'none' });
  });
});

describe('콕과 오늘의 알림 이동', () => {
  it('할 일이 있는 콕은 콕 상세 화면으로 이동한다', () => {
    // Given
    const context = { nudgeId: 7, todoId: 42 };
    // When
    const destination = resolveNotificationDestination(
      { type: 'NUDGE_RECEIVED', context },
      COMPACT,
    );
    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/nudges/[nudgeId]', params: { nudgeId: 7 } },
    });
  });

  it('리마인드 콕의 다른 테이블 ID를 일반 콕 ID로 해석하지 않는다', () => {
    // Given
    const context = { nudgeId: 7, friendId: 'friend' };
    // When
    const destination = resolveNotificationDestination(
      { type: 'NUDGE_RECEIVED', context },
      { shouldOpenToday: true, windowSizeClass: 'compact' },
    );
    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: {
        pathname: '/feed',
        params: { friendId: 'friend', date: 'today' },
      },
    });
  });

  it.each(['NUDGE_REPLIED', 'NUDGE_THANKED'] as const)(
    '%s 알림은 같은 콕 상세로 이동한다',
    (type) => {
      // Given
      const context = { nudgeId: 7 };
      // When
      const destination = resolveNotificationDestination({ type, context }, COMPACT);
      // Then
      expect(destination).toEqual({
        kind: 'route',
        href: { pathname: '/nudges/[nudgeId]', params: { nudgeId: 7 } },
      });
    },
  );

  it('과거 답장 알림에 콕 ID가 없으면 목록에서 확인할 수 있다', () => {
    // Given
    const source = { type: 'NUDGE_REPLIED' as const };
    // When
    const destination = resolveNotificationDestination(source, COMPACT);
    // Then
    expect(destination).toEqual({ kind: 'route', href: '/notifications' });
  });

  it('할 일 알림은 해당 할 일을 바로 열고 날짜 안내는 오늘 피드를 연다', () => {
    // When
    const todo = resolveNotificationDestination(
      { type: 'TODO_REMINDER', context: { todoId: 42 } },
      { shouldOpenToday: true, windowSizeClass: 'compact' },
    );
    const morning = resolveNotificationDestination(
      { type: 'MORNING_REMINDER' },
      { shouldOpenToday: true, windowSizeClass: 'compact' },
    );
    // Then
    expect(todo).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
    expect(morning).toEqual({
      kind: 'route',
      href: { pathname: '/feed', params: { date: 'today' } },
    });
  });

  it.each(['WEATHER_MORNING', 'WEATHER_EVENING'] as const)('%s 알림은 날씨를 바로 연다', (type) => {
    // Given
    const source = { type };
    // When
    const destination = resolveNotificationDestination(source, COMPACT);
    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/weather', params: { entry: 'notification' } },
    });
  });

  it('아침 날씨 알림이 옮길 할 일을 실으면 옮기기 시트를 연다', () => {
    // Given
    const source = {
      type: 'WEATHER_MORNING' as const,
      action: { type: 'DEEP_LINK' as const, url: '/weather/reschedule?todoIds=12,15&reason=rain' },
    };

    // When
    const destination = resolveNotificationDestination(source, COMPACT);

    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/weather/reschedule', params: { todoIds: '12,15', reason: 'rain' } },
    });
  });

  it('아침 날씨 알림의 링크가 낯설면 날씨 화면을 연다', () => {
    // Given
    const source = {
      type: 'WEATHER_MORNING' as const,
      action: { type: 'DEEP_LINK' as const, url: '/settings' },
    };

    // When
    const destination = resolveNotificationDestination(source, COMPACT);

    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/weather', params: { entry: 'notification' } },
    });
  });

  it('잘못된 할 일 ID로 상세 화면을 열지 않는다', () => {
    // Given
    const source = { type: 'TODO_SHARED' as const, context: { todoId: -1 } };

    // When
    const destination = resolveNotificationDestination(source, COMPACT);

    // Then
    expect(destination).toEqual({ kind: 'none' });
  });
});

describe('알림 타입별 목적지', () => {
  const todayFeed = { kind: 'route', href: { pathname: '/feed', params: { date: 'today' } } };
  const friendFeed = {
    kind: 'route',
    href: { pathname: '/feed', params: { friendId: 'friend-1', date: 'today' } },
  };
  const nudgeDetail = {
    kind: 'route',
    href: { pathname: '/nudges/[nudgeId]', params: { nudgeId: 7 } },
  };
  const todoDetail = {
    kind: 'route',
    href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
  };
  const none = { kind: 'none' };

  const cases: [NotificationType, NotificationContext, unknown][] = [
    [
      'FOLLOW_NEW',
      {},
      { kind: 'route', href: { pathname: '/friends', params: { view: 'receiver' } } },
    ],
    ['FOLLOW_ACCEPTED', { friendId: 'friend-1' }, friendFeed],
    ['NUDGE_RECEIVED', { nudgeId: 7, todoId: 42 }, nudgeDetail],
    ['NUDGE_RECEIVED', { todoId: 42 }, todoDetail],
    ['NUDGE_RECEIVED', { friendId: 'friend-1', nudgeId: 7 }, friendFeed],
    ['NUDGE_RECEIVED', {}, todayFeed],
    ['NUDGE_REPLIED', { nudgeId: 7 }, nudgeDetail],
    ['NUDGE_REPLIED', {}, { kind: 'route', href: '/notifications' }],
    ['NUDGE_THANKED', { nudgeId: 7 }, nudgeDetail],
    ['CHEER_RECEIVED', { friendId: 'friend-1' }, friendFeed],
    ['DAILY_COMPLETE', {}, todayFeed],
    ['FRIEND_COMPLETED', { friendId: 'friend-1' }, friendFeed],
    ['TODO_REMINDER', { todoId: 42 }, todoDetail],
    ['TODO_REMINDER', {}, todayFeed],
    ['TODO_SHARED', { todoId: 42 }, todoDetail],
    ['MORNING_REMINDER', {}, todayFeed],
    ['EVENING_REMINDER', {}, todayFeed],
    ['WEEKLY_ACHIEVEMENT', {}, { kind: 'route', href: '/achievements' }],
    ['WEEKLY_REPORT', {}, { kind: 'route', href: '/reports' }],
    ['MONTHLY_REPORT', {}, { kind: 'route', href: '/reports' }],
    ['AI_SUGGESTION', {}, { kind: 'route', href: '/suggestions' }],
    ['SYSTEM_NOTICE', {}, none],
    ['ADMIN_BROADCAST', {}, none],
    ['ADMIN_TARGETED', {}, none],
    ['WINBACK', {}, todayFeed],
    ['SOCIAL_DIGEST', {}, todayFeed],
    ['NUDGE_SUGGEST', { friendId: 'friend-1' }, friendFeed],
    ['LUNCH_NUDGE', {}, todayFeed],
    ['STREAK_AT_RISK', {}, todayFeed],
    [
      'WEATHER_MORNING',
      {},
      { kind: 'route', href: { pathname: '/weather', params: { entry: 'notification' } } },
    ],
    [
      'WEATHER_EVENING',
      {},
      { kind: 'route', href: { pathname: '/weather', params: { entry: 'notification' } } },
    ],
    ['INVITE_JOINED', {}, { kind: 'route', href: { pathname: '/friends/invite' } }],
    ['INVITE_REWARDED', {}, { kind: 'route', href: { pathname: '/friends/invite' } }],
    ['INVITE_PROGRESS', {}, { kind: 'route', href: { pathname: '/friends/invite' } }],
    ['INVITE_QUALIFY_REMINDER', {}, todayFeed],
    ['PREMIUM_GRANT_ENDING', {}, { kind: 'route', href: { pathname: '/settings/subscription' } }],
  ];

  it('모든 알림 타입의 목적지를 검증한다', () => {
    // When
    const result = new Set(cases.map(([type]) => type));

    // Then
    expect(result).toEqual(new Set(Object.values(NOTIFICATION_TYPE)));
  });

  it.each(cases)('%s %o', (type, context, expected) => {
    // When
    const result = resolveNotificationDestination(
      { type, context },
      { shouldOpenToday: true, windowSizeClass: 'compact' },
    );

    // Then
    expect(result).toEqual(expected);
  });
});

describe('펼친 화면의 할 일 알림', () => {
  it.each([
    ['TODO_REMINDER', { todoId: 42 }, undefined, { todoId: 42 }],
    ['NUDGE_RECEIVED', { todoId: 42 }, undefined, { todoId: 42 }],
    ['TODO_SHARED', { todoId: 42 }, undefined, { todoId: 42 }],
    ['TODO_SHARED', { todoId: 42 }, { commentId: COMMENT_ID }, { todoId: 42, comment: COMMENT_ID }],
  ] as const)('%s %o는 피드 상세 pane에 고른다', (type, context, routing, params) => {
    // When
    const destinations = (['medium', 'expanded'] as const).map((windowSizeClass) =>
      resolveNotificationDestination({ type, context, routing }, { windowSizeClass }),
    );

    // Then
    const expected = { kind: 'route', href: { pathname: '/feed', params } };
    expect(destinations).toEqual([expected, expected]);
  });
});

describe('펼친 화면 할 일 알림의 목록 pane', () => {
  const VIEWER = 'me';
  const DATE = '2026-08-14';

  it.each([
    [
      '친구 할 일 댓글은 그 친구의 그 날짜 피드',
      { todoOwnerId: 'friend-1', todoDate: DATE, commentId: COMMENT_ID },
      VIEWER,
      { friendId: 'friend-1', date: DATE, todoId: 42, comment: COMMENT_ID },
    ],
    [
      '내 할 일은 내 피드의 그 날짜',
      { todoOwnerId: VIEWER, todoDate: DATE },
      VIEWER,
      { date: DATE, todoId: 42 },
    ],
    [
      '나를 모르면 친구로 단정하지 않고 날짜만 맞춘다',
      { todoOwnerId: 'friend-1', todoDate: DATE },
      undefined,
      { date: DATE, todoId: 42 },
    ],
    [
      '형식이 틀린 날짜는 버리고 주인만 따른다',
      { todoOwnerId: 'friend-1', todoDate: '08/14' },
      VIEWER,
      { friendId: 'friend-1', todoId: 42 },
    ],
    ['주인·날짜가 없는 예전 알림은 기존 동작', {}, VIEWER, { todoId: 42 }],
  ])('%s', (_name, routing, viewerId, params) => {
    // When
    const result = resolveNotificationDestination(
      { type: 'TODO_SHARED', context: { todoId: 42 }, routing },
      { windowSizeClass: 'medium', viewerId },
    );

    // Then
    expect(result).toEqual({ kind: 'route', href: { pathname: '/feed', params } });
  });

  it.each(['TODO_REMINDER', 'NUDGE_RECEIVED'] as const)(
    '%s도 할 일 주인과 날짜로 목록 pane을 연다',
    (type) => {
      // When
      const result = resolveNotificationDestination(
        { type, context: { todoId: 42 }, routing: { todoOwnerId: VIEWER, todoDate: DATE } },
        { windowSizeClass: 'expanded', viewerId: VIEWER },
      );

      // Then
      expect(result).toEqual({
        kind: 'route',
        href: { pathname: '/feed', params: { date: DATE, todoId: 42 } },
      });
    },
  );

  it('접힌 화면은 주인·날짜가 있어도 할 일 상세 화면을 연다', () => {
    // When
    const result = resolveNotificationDestination(
      {
        type: 'TODO_SHARED',
        context: { todoId: 42 },
        routing: { todoOwnerId: 'friend-1', todoDate: DATE },
      },
      { windowSizeClass: 'compact', viewerId: VIEWER },
    );

    // Then
    expect(result).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
  });
});

describe('연간 구독 갱신 7일 전 알림', () => {
  // 서버 전용 PREMIUM_RENEWAL_UPCOMING은 SYSTEM_NOTICE로 오고, 새 앱은 navigation을, 구 앱은 deep link를 읽는다
  const RENEWAL_ACTION = { type: 'DEEP_LINK', url: NOTICE_DEEP_LINK_PATH.SUBSCRIPTION } as const;

  it.each([
    ['새 앱은 navigation SUBSCRIPTION으로', { navigation: { kind: 'SUBSCRIPTION' } } as const],
    ['구 앱은 공지 deep link로', {}],
  ])('%s 구독 영수증 화면을 연다', (_case, navigation) => {
    // When
    const result = resolveNotificationDestination(
      { type: 'SYSTEM_NOTICE', action: RENEWAL_ACTION, ...navigation },
      COMPACT,
    );

    // Then
    expect(result).toEqual({ kind: 'route', href: { pathname: '/settings/subscription' } });
  });
});

describe('isViewingNotificationDestination', () => {
  const TODO_42: NotificationDestination = {
    kind: 'route',
    href: { pathname: '/todo/[todoId]', params: { todoId: 42, comment: COMMENT_ID } },
  };
  const FRIEND_FEED_TODO_42: NotificationDestination = {
    kind: 'route',
    href: { pathname: '/feed', params: { friendId: 'friend-1', date: 'today', todoId: 42 } },
  };

  it.each([
    [
      '같은 할 일 상세면 댓글 위치가 달라도 이미 보고 있는 것이다',
      TODO_42,
      '/todo/42',
      { todoId: '42' },
      true,
    ],
    ['다른 할 일 상세면 보고 있지 않은 것이다', TODO_42, '/todo/7', { todoId: '7' }, false],
    [
      '펼친 화면의 같은 친구 피드 같은 할 일이면 날짜가 달라도 보고 있는 것이다',
      FRIEND_FEED_TODO_42,
      '/feed',
      { friendId: 'friend-1', date: '2026-11-10', todoId: '42' },
      true,
    ],
    [
      '펼친 화면이라도 친구가 아닌 내 피드면 보고 있지 않은 것이다',
      FRIEND_FEED_TODO_42,
      '/feed',
      { todoId: '42' },
      false,
    ],
    [
      '알림함이면 알림함 목적지를 보고 있는 것이다',
      { kind: 'route', href: '/notifications' },
      '/notifications',
      {},
      true,
    ],
    [
      '외부 링크는 앱 화면이 아니라 보고 있을 수 없다',
      { kind: 'browser', url: 'https://aido.app' },
      '/feed',
      {},
      false,
    ],
  ] as const)('%s', (_case, destination, pathname, params, expected) => {
    // When
    const isViewing = isViewingNotificationDestination(destination, { pathname, params });

    // Then
    expect(isViewing).toBe(expected);
  });
});

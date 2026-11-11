import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { NOTIFICATION_NAVIGATION_KIND, NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { DateKey } from '@src/shared/date/date-key';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import { createDateKey } from '@src/testing/date-key';
import type { Href } from 'expo-router';

import { NAVIGATION_CASES } from '../__tests__/notification-navigation-cases';
import { toNotificationTarget } from '../apis/notification.mapper';
import type { NotificationTarget } from '../domains/notification.model';
import {
  isViewingNotificationDestination,
  type NotificationDestination,
  toNotificationDestination,
} from './notification-destination';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const VIEWER = 'cmviewer00000000000000001';
const FRIEND = 'cmfriend00000000000000001';
const DATE = createDateKey('2026-08-14');

function todoTarget({
  ownerId = null,
  dateKey = null,
}: { ownerId?: string | null; dateKey?: DateKey | null } = {}) {
  return { kind: 'TODO', todoId: 42, ownerId, dateKey } satisfies NotificationTarget;
}

function todoCommentTarget(owner: { ownerId?: string; dateKey?: DateKey } = {}) {
  return {
    ...todoTarget(owner),
    kind: 'TODO_COMMENT',
    commentId: COMMENT_ID,
  } satisfies NotificationTarget;
}

describe('toNotificationDestination', () => {
  it('접힌 화면은 주인·날짜가 있어도 할 일 상세 화면을 연다', () => {
    // When
    const destination = toNotificationDestination(todoTarget({ ownerId: FRIEND, dateKey: DATE }), {
      windowSizeClass: 'compact',
      viewerId: VIEWER,
    });

    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
  });

  it.each(['medium', 'expanded'] as const)('%s 화면은 할 일을 피드 상세 pane에 고른다', (size) => {
    // When
    const todo = toNotificationDestination(todoTarget(), { windowSizeClass: size });
    const comment = toNotificationDestination(todoCommentTarget(), { windowSizeClass: size });

    // Then
    expect(todo).toEqual({ kind: 'route', href: { pathname: '/feed', params: { todoId: 42 } } });
    expect(comment).toEqual({
      kind: 'route',
      href: { pathname: '/feed', params: { todoId: 42, comment: COMMENT_ID } },
    });
  });

  it.each([
    [
      '친구 할 일 댓글은 그 친구의 그 날짜 피드',
      todoCommentTarget({ ownerId: FRIEND, dateKey: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42, comment: COMMENT_ID },
    ],
    [
      '친구 할 일은 그 친구의 그 날짜 피드',
      todoTarget({ ownerId: FRIEND, dateKey: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42 },
    ],
    [
      '내 할 일은 내 피드의 그 날짜',
      todoTarget({ ownerId: VIEWER, dateKey: DATE }),
      VIEWER,
      { date: DATE, todoId: 42 },
    ],
    [
      '나를 모르면 친구로 단정하지 않고 날짜만 맞춘다',
      todoTarget({ ownerId: FRIEND, dateKey: DATE }),
      undefined,
      { date: DATE, todoId: 42 },
    ],
    ['주인·날짜가 없으면 피드의 기본 날짜', todoTarget(), VIEWER, { todoId: 42 }],
  ] as const)('펼친 화면 목록 pane: %s', (_case, target, viewerId, params) => {
    // When
    const destination = toNotificationDestination(target, {
      windowSizeClass: 'medium',
      viewerId,
    });

    // Then
    expect(destination).toEqual({ kind: 'route', href: { pathname: '/feed', params } });
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

const FRIEND_ID = 'cmfriend00000000000000001';

const NONE: NotificationDestination = { kind: 'none' };
const INBOX: NotificationDestination = { kind: 'route', href: '/notifications' };
const TODAY_FEED: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/feed', params: { date: 'today' } },
};
const FRIEND_FEED: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/feed', params: { friendId: FRIEND_ID, date: 'today' } },
};
const FRIEND_REQUESTS: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/friends', params: { view: 'receiver' } },
};
const NUDGE_DETAIL: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/nudges/[nudgeId]', params: { nudgeId: 7 } },
};
const TODO_DETAIL: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
};
const TODO_COMMENT: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/todo/[todoId]', params: { todoId: 42, comment: COMMENT_ID } },
};
const WEATHER: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/weather', params: { entry: 'notification' } },
};
const INVITE: NotificationDestination = { kind: 'route', href: { pathname: '/friends/invite' } };
const SUBSCRIPTION: NotificationDestination = {
  kind: 'route',
  href: { pathname: '/settings/subscription' },
};
const ACHIEVEMENTS: NotificationDestination = { kind: 'route', href: '/achievements' };
const REPORTS: NotificationDestination = { kind: 'route', href: '/reports' };

function weatherReschedule(todoIds: string, reason: 'rain' | 'heat'): NotificationDestination {
  return { kind: 'route', href: { pathname: '/weather/reschedule', params: { todoIds, reason } } };
}

/** 대조표 줄마다 접힌 화면이 여는 곳. 서버가 줄을 더하면 여기에도 더해야 통과한다 */
const COMPACT_DESTINATIONS: Readonly<Record<string, NotificationDestination>> = {
  '친구 신청은 받은 신청 목록': FRIEND_REQUESTS,
  '친구 수락은 그 친구 피드': FRIEND_FEED,
  '친구 ID 없는 수락은 이동 없음': NONE,
  '할 일 콕은 콕 상세': NUDGE_DETAIL,
  '콕 ID 없는 할 일 콕은 할 일 상세': TODO_DETAIL,
  '할 일 없는 콕은 보낸 친구 피드': FRIEND_FEED,
  '콕 ID가 있어도 할 일이 없으면 보낸 친구 피드': FRIEND_FEED,
  '재료 없는 콕은 내 피드': TODAY_FEED,
  '콕 답장은 콕 상세': NUDGE_DETAIL,
  '콕 ID 없는 답장은 알림 목록': INBOX,
  '콕 고마움은 콕 상세': NUDGE_DETAIL,
  '콕 ID 없는 고마움은 알림 목록': INBOX,
  '응원은 응원과 보낸 친구': FRIEND_FEED,
  '응원 ID 없는 응원은 친구 피드': FRIEND_FEED,
  '친구 ID 없는 응원은 이동 없음': NONE,
  'DAILY_COMPLETE는 FEED 화면': TODAY_FEED,
  '친구 전체 완료는 친구 피드': FRIEND_FEED,
  '친구 ID 없는 전체 완료는 이동 없음': NONE,
  '할 일 리마인더는 주인과 날짜를 실은 상세': TODO_DETAIL,
  '주인 없는 할 일 리마인더는 상세': TODO_DETAIL,
  '할 일 없는 리마인더는 내 피드': TODAY_FEED,
  '댓글 알림은 댓글 위치': TODO_COMMENT,
  '주인 없는 댓글 알림도 댓글 위치': TODO_COMMENT,
  '댓글 재료가 없는 공유는 상세': TODO_DETAIL,
  '할 일 없는 공유는 이동 없음': NONE,
  'routing에 commentId만 있는 옛 댓글 알림': TODO_DETAIL,
  'MORNING_REMINDER는 FEED 화면': TODAY_FEED,
  'EVENING_REMINDER는 FEED 화면': TODAY_FEED,
  'WEEKLY_ACHIEVEMENT는 ACHIEVEMENTS 화면': ACHIEVEMENTS,
  'WEEKLY_REPORT는 REPORTS 화면': REPORTS,
  'MONTHLY_REPORT는 REPORTS 화면': REPORTS,
  'AI_SUGGESTION는 SUGGESTIONS 화면': { kind: 'route', href: '/suggestions' },
  '공지 /feed': TODAY_FEED,
  '공지 /achievements': ACHIEVEMENTS,
  '공지 /weather': WEATHER,
  '공지 /friends': { kind: 'route', href: '/friends' },
  '공지 /friends/invite': INVITE,
  '공지 /settings/subscription': SUBSCRIPTION,
  '공지 /settings/notifications': { kind: 'route', href: '/settings/notifications' },
  '공지의 모르는 경로는 이동 없음': NONE,
  '경로 없는 공지는 이동 없음': NONE,
  '전체 발송 /feed': TODAY_FEED,
  '경로 없는 전체 발송은 이동 없음': NONE,
  '개별 발송 /achievements': ACHIEVEMENTS,
  '경로 없는 개별 발송은 이동 없음': NONE,
  '브라우저 링크': { kind: 'browser', url: 'https://aido.kr/notice' },
  '앱 안 브라우저 링크': { kind: 'webview', url: 'https://aido.kr/notice' },
  'http(s)가 아닌 링크는 이동 없음': NONE,
  '주소 없는 링크는 이동 없음': NONE,
  'NONE 액션은 타입과 상관없이 이동 없음': NONE,
  'WINBACK는 FEED 화면': TODAY_FEED,
  'SOCIAL_DIGEST는 FEED 화면': TODAY_FEED,
  '콕 제안은 친구 피드': FRIEND_FEED,
  '친구 ID 없는 콕 제안은 이동 없음': NONE,
  'LUNCH_NUDGE는 FEED 화면': TODAY_FEED,
  'STREAK_AT_RISK는 FEED 화면': TODAY_FEED,
  'WEATHER_MORNING는 WEATHER 화면': WEATHER,
  '아침 날씨의 더위 옮기기 링크': weatherReschedule('12,15', 'heat'),
  '이유 없는 옮기기 링크는 비': weatherReschedule('12', 'rain'),
  '잘못된 할 일 목록의 옮기기 링크는 날씨 화면': WEATHER,
  '옮기기 링크의 모르는 이유': WEATHER,
  '옮기기 링크의 지수 표기 할 일 ID': weatherReschedule('100', 'rain'),
  '옮기기 링크의 앞자리 0 할 일 ID': weatherReschedule('12', 'rain'),
  '끝이 쉼표인 옮기기 링크는 날씨 화면': WEATHER,
  '한도를 넘은 옮기기 링크는 날씨 화면': WEATHER,
  'WEATHER_EVENING는 WEATHER 화면': WEATHER,
  'INVITE_JOINED는 INVITE 화면': INVITE,
  'INVITE_REWARDED는 INVITE 화면': INVITE,
  'INVITE_PROGRESS는 INVITE 화면': INVITE,
  'INVITE_QUALIFY_REMINDER는 FEED 화면': TODAY_FEED,
  'PREMIUM_GRANT_ENDING는 SUBSCRIPTION 화면': SUBSCRIPTION,
};

const SERVER_NAVIGATION_CASES = NAVIGATION_CASES.flatMap(({ name, navigation }) =>
  navigation == null ? [] : [{ name, navigation }],
);
const WIDE_WINDOW_SIZE_CLASSES: readonly WindowSizeClass[] = ['medium', 'expanded'];
const VIEWER_IDS = [undefined, FRIEND_ID, 'cmviewer00000000000000001'];

describe('toNotificationDestination — 서버 navigation 규칙별 목적지', () => {
  it('31개 알림 타입이 모두 대조표에 있다', () => {
    // Given
    const types = new Set(NAVIGATION_CASES.map(({ source }) => source.type));

    // When
    const missing = Object.values(NOTIFICATION_TYPE).filter((type) => !types.has(type));

    // Then
    expect(Object.values(NOTIFICATION_TYPE)).toHaveLength(31);
    expect(missing).toEqual([]);
  });

  it('19개 navigation kind가 모두 대조표에 있다', () => {
    // Given
    const kinds = new Set(SERVER_NAVIGATION_CASES.map(({ navigation }) => navigation.kind));

    // When
    const missing = Object.values(NOTIFICATION_NAVIGATION_KIND).filter((kind) => !kinds.has(kind));

    // Then
    expect(Object.values(NOTIFICATION_NAVIGATION_KIND)).toHaveLength(19);
    expect(missing).toEqual([]);
  });

  it('서버 navigation이 있는 모든 줄에 앱 목적지가 정해져 있다', () => {
    // When
    const missing = SERVER_NAVIGATION_CASES.filter(({ name }) => !(name in COMPACT_DESTINATIONS));

    // Then
    expect(missing).toEqual([]);
  });

  it.each(SERVER_NAVIGATION_CASES)('$name: 접힌 화면은 정한 곳을 연다', ({ name, navigation }) => {
    // When
    const destination = toNotificationDestination(toNotificationTarget(navigation), {
      windowSizeClass: 'compact',
    });

    // Then
    expect(destination).toEqual(COMPACT_DESTINATIONS[name]);
  });

  describe.each(
    WIDE_WINDOW_SIZE_CLASSES.flatMap((windowSizeClass) =>
      VIEWER_IDS.map((viewerId) => ({ windowSizeClass, viewerId })),
    ),
  )('$windowSizeClass, 나 $viewerId', (context) => {
    it.each(
      SERVER_NAVIGATION_CASES.filter(
        ({ navigation }) => navigation.kind !== 'TODO' && navigation.kind !== 'TODO_COMMENT',
      ),
    )('$name: 할 일이 아닌 목적지는 접힌 화면과 같다', ({ name, navigation }) => {
      // When
      const destination = toNotificationDestination(toNotificationTarget(navigation), context);

      // Then
      expect(destination).toEqual(COMPACT_DESTINATIONS[name]);
    });
  });
});

const APP_DIRECTORY = join(__dirname, '../../../../app');
const ROUTE_GROUP = /^\(.+\)$/;
const WINDOW_SIZE_CLASSES: readonly WindowSizeClass[] = ['compact', 'expanded'];

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findRouteFiles(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

/** 라우트 파일을 URL 모양으로 바꾼다. 그룹 폴더와 index는 URL에 없다. */
function getRoutePathnames(): Set<string> {
  const pathnames = findRouteFiles(APP_DIRECTORY)
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('_layout.tsx'))
    .map((file) => {
      const segments = relative(APP_DIRECTORY, file)
        .replace(/\.tsx$/, '')
        .split(sep)
        .filter((segment) => !ROUTE_GROUP.test(segment) && segment !== 'index');
      return `/${segments.join('/')}`;
    });

  return new Set(pathnames);
}

function getHrefPathname(href: Href): string | undefined {
  const pathname = typeof href === 'string' ? href : href.pathname;

  return pathname?.split('?')[0];
}

function getRouteDestinationPathnames(
  destinations: readonly NotificationDestination[],
): (string | undefined)[] {
  return destinations.flatMap((destination) =>
    destination.kind === 'route' ? [getHrefPathname(destination.href)] : [],
  );
}

describe('알림 목적지와 라우트 파일', () => {
  const routePathnames = getRoutePathnames();

  it.each(
    NAVIGATION_CASES.flatMap(({ name, navigation }) =>
      navigation == null ? [] : [{ name, navigation }],
    ),
  )('$name: 서버 navigation의 목적지는 있는 화면이다', ({ navigation }) => {
    // When
    const destinations = WINDOW_SIZE_CLASSES.map((windowSizeClass) =>
      toNotificationDestination(toNotificationTarget(navigation), { windowSizeClass }),
    );

    // Then
    getRouteDestinationPathnames(destinations).forEach((pathname) => {
      expect(routePathnames).toContain(pathname);
    });
  });

  it('읽지 못한 알림이 여는 알림함은 있는 화면이다', () => {
    // When
    const destination = toNotificationDestination(
      { kind: 'NOTIFICATIONS' },
      { windowSizeClass: 'compact' },
    );

    // Then
    expect(getRouteDestinationPathnames([destination])).toEqual(['/notifications']);
    expect(routePathnames).toContain('/notifications');
  });
});

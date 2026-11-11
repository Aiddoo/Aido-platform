import { NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { WeatherEntry } from '@src/features/weather/schemas/weather-entry-params.schema';
import {
  parseWeatherRescheduleUrl,
  toWeatherRescheduleHref,
} from '@src/features/weather/utils/weather-reschedule-link';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import type { Href } from 'expo-router';
import { P, match } from 'ts-pattern';

import { NOTIFICATION_TYPE_TRAITS } from '../constants/notification.constants';
import {
  type NotificationAction,
  type NotificationContext,
  type NotificationDestinationRouting,
  notificationDestinationRoutingSchema,
  type NotificationRouting,
  type NotificationType,
} from '../domains/notification.model';
import { type NotificationNavigation } from '../schemas/push-notification-payload.schema';

export type NotificationDestination =
  | { kind: 'none' }
  | { kind: 'route'; href: Href }
  | { kind: 'browser'; url: string }
  | { kind: 'webview'; url: string };

export interface NotificationDestinationSource {
  /** 새 서버의 모르는 타입이면 null이다 */
  type: NotificationType | null;
  context?: NotificationContext;
  routing?: NotificationRouting;
  action?: NotificationAction;
  /** 서버가 고른 목적지. 없으면(옛 푸시·옛 알림함 항목) 구 필드로 고른다 */
  navigation?: NotificationNavigation;
}

type LegacyDestinationSource = NotificationDestinationSource & { type: NotificationType };

const NO_DESTINATION: NotificationDestination = { kind: 'none' };

export const NOTIFICATION_INBOX_DESTINATION: NotificationDestination = {
  kind: 'route',
  href: '/notifications',
};

/** 지금 보고 있는 화면. 경로는 그룹 없이(`usePathname`), 값은 경로 조각과 쿼리를 합친 것(`useGlobalSearchParams`)이다 */
export interface CurrentRoute {
  pathname: string;
  params: Partial<Record<string, string | string[]>>;
}

/** 같은 화면 안에서 날짜·진입 경로·댓글 위치만 바꾸는 값이라 다른 화면으로 보지 않는다 */
const VIEW_POSITION_PARAMS: ReadonlySet<string> = new Set(['date', 'entry', 'comment']);
const DYNAMIC_SEGMENT = /\[(?:\.\.\.)?([^\]]+)\]/g;

function toParamText(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(',') : String(value);
}

/** 알림이 여는 화면을 이미 보고 있는지. 경로가 같고 보는 대상(할 일·친구·콕 id 등)이 모두 같아야 한다 */
export function isViewingNotificationDestination(
  destination: NotificationDestination,
  current: CurrentRoute,
): boolean {
  if (destination.kind !== 'route') {
    return false;
  }
  const { href } = destination;
  const [pathname = '', params = {}] =
    typeof href === 'string' ? [href.split('?')[0]] : [href.pathname, href.params];
  const targetParams = new Map(
    Object.entries(params).map(([key, value]) => [key, toParamText(value)] as const),
  );
  const pathParams = new Set<string>();
  const targetPathname = pathname.replace(DYNAMIC_SEGMENT, (_segment, name: string) => {
    pathParams.add(name);
    return targetParams.get(name) ?? '';
  });
  if (targetPathname !== current.pathname) {
    return false;
  }
  return [...targetParams].every(
    ([key, value]) =>
      value == null ||
      pathParams.has(key) ||
      VIEW_POSITION_PARAMS.has(key) ||
      toParamText(current.params[key]) === value,
  );
}

interface NotificationDestinationOptions {
  /** 피드로 열 때 날짜를 오늘로 맞춘다 */
  shouldOpenToday?: boolean;
  /** 할 일 목적지를 상세 화면으로 열지 펼친 피드의 상세 pane으로 열지 정한다. */
  windowSizeClass: WindowSizeClass;
  /** 나. 할 일 주인이 내가 아니면 펼친 화면의 목록 pane을 그 친구 피드로 연다 */
  viewerId?: string;
}

export function resolveNotificationDestination(
  source: NotificationDestinationSource,
  options: NotificationDestinationOptions,
): NotificationDestination {
  if (source.navigation != null) {
    return toNavigationDestination(source.navigation, options);
  }
  if (source.type == null) {
    return { kind: 'route', href: '/notifications' };
  }
  return toLegacyFieldsDestination({ ...source, type: source.type }, options);
}

function toLegacyFieldsDestination(
  source: LegacyDestinationSource,
  { shouldOpenToday, windowSizeClass, viewerId }: NotificationDestinationOptions,
): NotificationDestination {
  if (source.action?.type === 'NONE') {
    return NO_DESTINATION;
  }
  if (source.action?.type === 'BROWSER') {
    return toExternalDestination('browser', source.action.url);
  }
  if (source.action?.type === 'WEBVIEW') {
    return toExternalDestination('webview', source.action.url);
  }

  // 종류만으로 갈 곳을 정할 수 없는 공지. 서버가 DEEP_LINK url에 고른 앱 경로를 따른다(리텐션 /feed·/achievements 등)
  if (NOTIFICATION_TYPE_TRAITS[source.type].legacyDestination === 'notice') {
    return toNoticeDestination(source.action?.url, { shouldOpenToday });
  }

  // 아침 날씨 알림이 할 일과 겹친 비·더위를 알리면 옮기기 시트로 바로 연다. 링크가 없거나 낯설면 날씨 화면이다.
  const rescheduleHref =
    source.type === NOTIFICATION_TYPE.WEATHER_MORNING
      ? parseWeatherRescheduleUrl(source.action?.url)
      : null;
  if (rescheduleHref != null) {
    return { kind: 'route', href: rescheduleHref };
  }

  const routing = parseNotificationRouting(source);
  return routing == null
    ? NO_DESTINATION
    : toRouteDestination(routing, { shouldOpenToday, windowSizeClass, viewerId });
}

/** 구 필드로 고른 곳과 같아야 한다(`packages/api/test-fixtures/notification-navigation.cases.json`) */
function toNavigationDestination(
  navigation: NotificationNavigation,
  { shouldOpenToday, windowSizeClass, viewerId }: NotificationDestinationOptions,
): NotificationDestination {
  const feedDate = shouldOpenToday ? 'today' : undefined;
  return (
    match(navigation)
      .returnType<NotificationDestination>()
      .with({ kind: 'NONE' }, () => NO_DESTINATION)
      .with({ kind: 'EXTERNAL_URL', presentation: 'BROWSER' }, ({ url }) => ({
        kind: 'browser',
        url,
      }))
      .with({ kind: 'EXTERNAL_URL', presentation: 'WEBVIEW' }, ({ url }) => ({
        kind: 'webview',
        url,
      }))
      .with({ kind: 'FEED' }, () => ({
        kind: 'route',
        href: { pathname: '/feed', params: { date: feedDate } },
      }))
      // 응원은 지금처럼 친구 피드로 연다. cheerId는 이동에 쓰지 않는다
      .with({ kind: P.union('FRIEND_FEED', 'CHEER') }, ({ friendId }) => ({
        kind: 'route',
        href: { pathname: '/feed', params: { friendId, date: feedDate } },
      }))
      .with({ kind: 'FRIENDS' }, () => ({ kind: 'route', href: '/friends' }))
      .with({ kind: 'FRIEND_REQUESTS' }, () => ({
        kind: 'route',
        href: { pathname: '/friends', params: { view: 'receiver' } },
      }))
      .with({ kind: 'TODO' }, ({ todoId, ...target }) => ({
        kind: 'route',
        href: toTodoDetailRoute(windowSizeClass, {
          todoId,
          ...toTodoFeedTarget(target, viewerId),
        }),
      }))
      .with({ kind: 'TODO_COMMENT' }, ({ todoId, commentId, ...target }) => ({
        kind: 'route',
        href: toTodoDetailRoute(windowSizeClass, {
          todoId,
          comment: commentId,
          ...toTodoFeedTarget(target, viewerId),
        }),
      }))
      .with({ kind: 'NUDGE' }, ({ nudgeId }) => ({
        kind: 'route',
        href: { pathname: '/nudges/[nudgeId]', params: { nudgeId } },
      }))
      .with({ kind: 'WEATHER' }, () => ({
        kind: 'route',
        href: {
          pathname: '/weather',
          params: { entry: 'notification' satisfies WeatherEntry },
        },
      }))
      .with({ kind: 'WEATHER_RESCHEDULE' }, ({ todoIds, reason }) => ({
        kind: 'route',
        href: toWeatherRescheduleHref({ todoIds, reason }),
      }))
      .with({ kind: 'ACHIEVEMENTS' }, () => ({ kind: 'route', href: '/achievements' }))
      .with({ kind: 'REPORTS' }, () => ({ kind: 'route', href: '/reports' }))
      .with({ kind: 'SUGGESTIONS' }, () => ({ kind: 'route', href: '/suggestions' }))
      .with({ kind: 'INVITE' }, () => ({
        kind: 'route',
        href: { pathname: '/friends/invite' },
      }))
      .with({ kind: 'SUBSCRIPTION' }, () => ({
        kind: 'route',
        href: { pathname: '/settings/subscription' },
      }))
      .with({ kind: 'NOTIFICATIONS' }, () => ({ kind: 'route', href: '/notifications' }))
      .with({ kind: 'NOTIFICATION_SETTINGS' }, () => ({
        kind: 'route',
        href: '/settings/notifications',
      }))
      .exhaustive()
  );
}

/** 공지의 앱 경로는 아는 화면만 연다. 모르는 경로, 상세 id·프리미엄 확인이 필요한 경로는 이동하지 않는다. */
function toNoticeDestination(
  url: string | undefined,
  { shouldOpenToday }: Pick<NotificationDestinationOptions, 'shouldOpenToday'>,
): NotificationDestination {
  const feedDate = shouldOpenToday ? 'today' : undefined;
  return match(url)
    .with('/feed', () => ({
      kind: 'route' as const,
      href: { pathname: '/feed' as const, params: { date: feedDate } },
    }))
    .with('/friends/invite', () => ({
      kind: 'route' as const,
      href: { pathname: '/friends/invite' as const },
    }))
    .with('/settings/subscription', () => ({
      kind: 'route' as const,
      href: { pathname: '/settings/subscription' as const },
    }))
    .with('/weather', () => ({
      kind: 'route' as const,
      href: {
        pathname: '/weather' as const,
        params: { entry: 'notification' satisfies WeatherEntry },
      },
    }))
    .with('/achievements', '/friends', '/settings/notifications', (href) => ({
      kind: 'route' as const,
      href,
    }))
    .otherwise(() => NO_DESTINATION);
}

function parseNotificationRouting(
  source: LegacyDestinationSource,
): NotificationDestinationRouting | null {
  const candidate = {
    type: NOTIFICATION_TYPE_TRAITS[source.type].legacyDestination === 'feed' ? 'FEED' : source.type,
    todoId: source.context?.todoId,
    nudgeId: source.context?.nudgeId,
    friendId: source.context?.friendId,
    commentId: source.routing?.commentId,
    todoOwnerId: source.routing?.todoOwnerId,
    todoDate: source.routing?.todoDate,
  };
  const result = notificationDestinationRoutingSchema.safeParse(candidate);

  return result.success ? result.data : null;
}

function toExternalDestination(kind: 'browser' | 'webview', url?: string): NotificationDestination {
  return url != null && /^https?:\/\//.test(url) ? { kind, url } : NO_DESTINATION;
}

function toRouteDestination(
  routing: NotificationDestinationRouting,
  { shouldOpenToday, windowSizeClass, viewerId }: NotificationDestinationOptions,
): NotificationDestination {
  const toTodoFeed = (target: TodoTarget) => toTodoFeedTarget(target, viewerId);
  const feedDate = shouldOpenToday ? 'today' : undefined;
  return (
    match(routing)
      .with({ type: 'NUDGE_RECEIVED', nudgeId: P.number, todoId: P.number }, ({ nudgeId }) => ({
        kind: 'route' as const,
        href: { pathname: '/nudges/[nudgeId]' as const, params: { nudgeId } },
      }))
      .with(
        { type: P.union('NUDGE_REPLIED', 'NUDGE_THANKED'), nudgeId: P.number },
        ({ nudgeId }) => ({
          kind: 'route' as const,
          href: { pathname: '/nudges/[nudgeId]' as const, params: { nudgeId } },
        }),
      )
      .with({ type: P.union('NUDGE_REPLIED', 'NUDGE_THANKED') }, () => ({
        kind: 'route' as const,
        href: '/notifications' as const,
      }))
      .with({ type: P.union('NUDGE_RECEIVED', 'TODO_REMINDER'), todoId: P.number }, (routing) => ({
        kind: 'route' as const,
        href: toTodoDetailRoute(windowSizeClass, {
          todoId: routing.todoId,
          ...toTodoFeed(routing),
        }),
      }))
      .with({ type: 'NUDGE_RECEIVED', friendId: P.string }, ({ friendId }) => ({
        kind: 'route' as const,
        href: { pathname: '/feed' as const, params: { friendId, date: feedDate } },
      }))
      .with({ type: P.union('NUDGE_RECEIVED', 'TODO_REMINDER') }, () => ({
        kind: 'route' as const,
        href: { pathname: '/feed' as const, params: { date: feedDate } },
      }))
      .with({ type: P.union('WEATHER_MORNING', 'WEATHER_EVENING') }, () => ({
        kind: 'route' as const,
        href: {
          pathname: '/weather' as const,
          params: { entry: 'notification' satisfies WeatherEntry },
        },
      }))
      // 댓글 알림은 할 일 상세 한 화면을 그 댓글 위치(`?comment=`)로 연다. 펼친 화면은 피드 pane이다
      .with({ type: 'TODO_SHARED' }, (routing) => ({
        kind: 'route' as const,
        href: toTodoDetailRoute(windowSizeClass, {
          todoId: routing.todoId,
          comment: routing.commentId,
          ...toTodoFeed(routing),
        }),
      }))
      .with(
        {
          type: P.union('FOLLOW_ACCEPTED', 'CHEER_RECEIVED', 'FRIEND_COMPLETED', 'NUDGE_SUGGEST'),
        },
        ({ friendId }) => ({
          kind: 'route' as const,
          href: { pathname: '/feed' as const, params: { friendId, date: feedDate } },
        }),
      )
      .with({ type: 'FOLLOW_NEW' }, () => ({
        kind: 'route' as const,
        href: { pathname: '/friends' as const, params: { view: 'receiver' } },
      }))
      .with({ type: 'WEEKLY_ACHIEVEMENT' }, () => ({
        kind: 'route' as const,
        href: '/achievements' as const,
      }))
      .with({ type: P.union('WEEKLY_REPORT', 'MONTHLY_REPORT') }, () => ({
        kind: 'route' as const,
        href: '/reports' as const,
      }))
      .with({ type: 'AI_SUGGESTION' }, () => ({
        kind: 'route' as const,
        href: '/suggestions' as const,
      }))
      .with({ type: P.union('INVITE_JOINED', 'INVITE_REWARDED', 'INVITE_PROGRESS') }, () => ({
        kind: 'route' as const,
        href: { pathname: '/friends/invite' as const },
      }))
      .with({ type: 'PREMIUM_GRANT_ENDING' }, () => ({
        kind: 'route' as const,
        href: { pathname: '/settings/subscription' as const },
      }))
      .with({ type: 'FEED' }, () => ({
        kind: 'route' as const,
        href: { pathname: '/feed' as const, params: { date: feedDate } },
      }))
      .exhaustive()
  );
}

interface TodoTarget {
  todoOwnerId?: string;
  todoDate?: string;
}

/** 펼친 화면 목록 pane의 피드. 남의 할 일이면 그 친구 피드, 내 할 일이거나 나를 모르면 내 피드다. */
function toTodoFeedTarget({ todoOwnerId, todoDate }: TodoTarget, viewerId?: string) {
  const isFriendTodo = todoOwnerId != null && viewerId != null && todoOwnerId !== viewerId;
  return { friendId: isFriendTodo ? todoOwnerId : undefined, date: todoDate };
}

interface TodoDetailTarget {
  todoId: number;
  /** 열 때 바로 보일 댓글 대화 */
  comment?: string;
  /** 친구의 할 일이면 그 친구. 내 할 일이거나 모르면 비운다 */
  friendId?: string;
  /** 할 일 날짜(YYYY-MM-DD). 모르면 피드의 기본 날짜다 */
  date?: string;
}

/** 목록에서 고를 때처럼 접힌 화면은 상세를 push하고, 펼친 화면은 피드 상세 pane에 고른다 */
function toTodoDetailRoute(
  windowSizeClass: WindowSizeClass,
  { todoId, comment, friendId, date }: TodoDetailTarget,
) {
  if (windowSizeClass === 'compact') {
    return { pathname: '/todo/[todoId]' as const, params: { todoId, comment } };
  }
  return { pathname: '/feed' as const, params: { friendId, date, todoId, comment } };
}

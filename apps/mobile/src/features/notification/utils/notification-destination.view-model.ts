import { toWeatherHref } from '@src/features/weather/utils/weather-link.view-model';
import { toWeatherRescheduleHref } from '@src/features/weather/utils/weather-reschedule-link.view-model';
import type { DateKey } from '@src/shared/date/date-key';
import type { WindowSizeClass } from '@src/shared/ui';
import type { Href } from 'expo-router';
import { P, match } from 'ts-pattern';

import type { NotificationTarget } from '../domains/notification.model';

export type NotificationDestination =
  | { kind: 'none' }
  | { kind: 'route'; href: Href }
  | { kind: 'browser'; url: string }
  | { kind: 'webview'; url: string };

export const NOTIFICATION_INBOX_DESTINATION: NotificationDestination = {
  kind: 'route',
  href: '/notifications',
};

/** 지금 보고 있는 화면. 경로는 그룹 없이(`usePathname`), 값은 그 화면 route의 경로 조각과 쿼리(`useFocusedRouteParams`)다 */
export interface CurrentRoute {
  pathname: string;
  params: Readonly<Record<string, unknown>>;
}

/** 같은 화면 안에서 날짜·진입 경로·연 시각·댓글 위치만 바꾸는 값이라 다른 화면으로 보지 않는다 */
const VIEW_POSITION_PARAMS: ReadonlySet<string> = new Set(['date', 'entry', 'openedAt', 'comment']);
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

/**
 * 탭 위 루트 Stack에 쌓이는 상세 화면의 경로. 탭(`(tabs)`)이나 안쪽 Stack(`weather`)의 화면은
 * 미리보기가 그 navigator에 화면을 미리 넣어 탭에 params가 남을 수 있다. 없으면 null이다
 */
export function findRootStackDetailHref(destination: NotificationDestination): Href | null {
  if (destination.kind !== 'route') {
    return null;
  }
  const { href } = destination;
  const pathname = typeof href === 'string' ? href.split('?')[0] : href.pathname;
  const isRootStackDetail = pathname === '/todo/[todoId]' || pathname === '/nudges/[nudgeId]';
  return isRootStackDetail ? href : null;
}

interface NotificationDestinationContext {
  /** 할 일 목적지를 상세 화면으로 열지 펼친 피드의 상세 pane으로 열지 정한다 */
  windowSizeClass: WindowSizeClass;
  /** 나. 할 일 주인이 내가 아니면 펼친 화면의 목록 pane을 그 친구 피드로 연다 */
  viewerId?: string;
  /** 알림을 연 시각(epoch ms). Stack에 남은 날씨 화면을 다시 올려도 열 때마다 센다(`toWeatherHref`) */
  openedAt: number;
}

/** 알림을 누르면 열 화면. 목적지는 서버가 고르고 앱은 화면 크기와 보는 사람에 맞춰 경로만 정한다 */
export function toNotificationDestination(
  target: NotificationTarget,
  { windowSizeClass, viewerId, openedAt }: NotificationDestinationContext,
): NotificationDestination {
  return (
    match(target)
      .returnType<NotificationDestination>()
      .with({ kind: 'NONE' }, () => ({ kind: 'none' }))
      .with({ kind: 'EXTERNAL_URL', opensIn: 'BROWSER' }, ({ url }) => ({
        kind: 'browser',
        url,
      }))
      .with({ kind: 'EXTERNAL_URL', opensIn: 'WEBVIEW' }, ({ url }) => ({
        kind: 'webview',
        url,
      }))
      .with({ kind: 'FEED' }, () => ({
        kind: 'route',
        href: { pathname: '/feed', params: { date: 'today' } },
      }))
      // 응원은 친구 피드로 연다. cheerId는 이동에 쓰지 않는다
      .with({ kind: P.union('FRIEND_FEED', 'CHEER') }, ({ friendId }) => ({
        kind: 'route',
        href: { pathname: '/feed', params: { friendId, date: 'today' } },
      }))
      .with({ kind: 'FRIENDS' }, () => ({ kind: 'route', href: '/friends' }))
      .with({ kind: 'FRIEND_REQUESTS' }, () => ({
        kind: 'route',
        href: { pathname: '/friends', params: { view: 'receiver' } },
      }))
      .with({ kind: 'TODO' }, ({ todoId, ownerId, dateKey }) => ({
        kind: 'route',
        href: toTodoDetailRoute(windowSizeClass, {
          todoId,
          ...toTodoFeed({ ownerId, dateKey }, viewerId),
        }),
      }))
      // 댓글 알림은 할 일 상세 한 화면을 그 댓글 위치(`?comment=`)로 연다. 펼친 화면은 피드 pane이다
      .with({ kind: 'TODO_COMMENT' }, ({ todoId, commentId, ownerId, dateKey }) => ({
        kind: 'route',
        href: toTodoDetailRoute(windowSizeClass, {
          todoId,
          comment: commentId,
          ...toTodoFeed({ ownerId, dateKey }, viewerId),
        }),
      }))
      .with({ kind: 'NUDGE' }, ({ nudgeId }) => ({
        kind: 'route',
        href: { pathname: '/nudges/[nudgeId]', params: { nudgeId } },
      }))
      .with({ kind: 'WEATHER' }, () => ({
        kind: 'route',
        href: toWeatherHref({ entry: 'notification', openedAt }),
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
      .with({ kind: 'NOTIFICATIONS' }, () => NOTIFICATION_INBOX_DESTINATION)
      .with({ kind: 'NOTIFICATION_SETTINGS' }, () => ({
        kind: 'route',
        href: '/settings/notifications',
      }))
      .exhaustive()
  );
}

/** 펼친 화면 목록 pane의 피드. 남의 할 일이면 그 친구 피드, 내 할 일이거나 나를 모르면 내 피드다. */
function toTodoFeed(
  { ownerId, dateKey }: { ownerId: string | null; dateKey: DateKey | null },
  viewerId: string | undefined,
) {
  const isFriendTodo = ownerId != null && viewerId != null && ownerId !== viewerId;
  // 경로 값은 없으면 빼야 URL에 실리지 않는다
  return { friendId: isFriendTodo ? ownerId : undefined, date: dateKey ?? undefined };
}

interface TodoDetailTarget {
  todoId: number;
  /** 열 때 바로 보일 댓글 대화 */
  comment?: string;
  /** 친구의 할 일이면 그 친구. 내 할 일이거나 모르면 비운다 */
  friendId?: string;
  /** 할 일 날짜. 모르면 피드의 기본 날짜다 */
  date?: DateKey;
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

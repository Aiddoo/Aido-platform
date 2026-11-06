import { NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { WeatherEntry } from '@src/features/weather/schemas/weather-entry-params.schema';
import { parseWeatherRescheduleUrl } from '@src/features/weather/utils/weather-reschedule-link';
import type { WindowSizeClass } from '@src/shared/utils/window-size-class';
import type { Href } from 'expo-router';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

import type {
  NotificationAction,
  NotificationContext,
  NotificationRouting,
  NotificationType,
} from '../domains/notification.model';

export type NotificationDestination =
  | { kind: 'none' }
  | { kind: 'route'; href: Href }
  | { kind: 'browser'; url: string }
  | { kind: 'webview'; url: string };

export interface NotificationDestinationSource {
  type: NotificationType;
  context?: NotificationContext;
  routing?: NotificationRouting;
  action?: NotificationAction;
}

/** 서버(1.13.0+)가 할 일 알림에 싣는 할 일 주인·날짜. 예전 알림에는 없다. */
const todoTargetShape = {
  todoOwnerId: z.string().min(1).optional().catch(undefined),
  todoDate: z.iso.date().optional().catch(undefined),
};

const routingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(NOTIFICATION_TYPE.TODO_SHARED),
    todoId: z.number().int().positive(),
    commentId: z.cuid().optional().catch(undefined),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_NEW) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_ACCEPTED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.CHEER_RECEIVED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FRIEND_COMPLETED), friendId: z.string() }),
  z.object({
    type: z.literal(NOTIFICATION_TYPE.NUDGE_RECEIVED),
    friendId: z.string().min(1).optional(),
    todoId: z.number().int().positive().optional(),
    nudgeId: z.number().int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({
    type: z.literal(NOTIFICATION_TYPE.NUDGE_REPLIED),
    nudgeId: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(NOTIFICATION_TYPE.NUDGE_THANKED),
    nudgeId: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(NOTIFICATION_TYPE.TODO_REMINDER),
    todoId: z.number().int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEATHER_MORNING) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEATHER_EVENING) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.NUDGE_SUGGEST), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_ACHIEVEMENT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.MONTHLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.AI_SUGGESTION) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.PREMIUM_GRANT_ENDING) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.INVITE_JOINED) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.INVITE_REWARDED) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.INVITE_PROGRESS) }),
  z.object({ type: z.literal('FEED') }),
]);

type ResolvedNotificationRoute = z.infer<typeof routingSchema>;

const FEED_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NOTIFICATION_TYPE.DAILY_COMPLETE,
  NOTIFICATION_TYPE.MORNING_REMINDER,
  NOTIFICATION_TYPE.EVENING_REMINDER,
  NOTIFICATION_TYPE.WINBACK,
  NOTIFICATION_TYPE.SOCIAL_DIGEST,
  NOTIFICATION_TYPE.LUNCH_NUDGE,
  NOTIFICATION_TYPE.STREAK_AT_RISK,
  // 초대받은 사람이 오늘 할 일을 끝내 사용 시작하도록 오늘 피드로 연다
  NOTIFICATION_TYPE.INVITE_QUALIFY_REMINDER,
]);

/** 종류만으로 갈 곳을 정할 수 없는 공지. 서버가 DEEP_LINK url에 고른 앱 경로를 따른다(리텐션 /feed·/achievements 등). */
const NOTICE_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NOTIFICATION_TYPE.SYSTEM_NOTICE,
  NOTIFICATION_TYPE.ADMIN_BROADCAST,
  NOTIFICATION_TYPE.ADMIN_TARGETED,
]);

const NO_DESTINATION: NotificationDestination = { kind: 'none' };

interface NotificationDestinationOptions {
  today?: string;
  /** 할 일 목적지를 상세 화면으로 열지 펼친 피드의 상세 pane으로 열지 정한다. */
  windowSizeClass: WindowSizeClass;
  /** 나. 할 일 주인이 내가 아니면 펼친 화면의 목록 pane을 그 친구 피드로 연다 */
  viewerId?: string;
}

export function resolveNotificationDestination(
  source: NotificationDestinationSource,
  { today, windowSizeClass, viewerId }: NotificationDestinationOptions,
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

  if (NOTICE_NOTIFICATION_TYPES.has(source.type)) {
    return toNoticeDestination(source.action?.url, today);
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
    : toRouteDestination(routing, { today, windowSizeClass, viewerId });
}

/** 공지의 앱 경로는 아는 화면만 연다. 모르는 경로, 상세 id·프리미엄 확인이 필요한 경로는 이동하지 않는다. */
function toNoticeDestination(url: string | undefined, today?: string): NotificationDestination {
  const feedDate = today ? 'today' : undefined;
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
  source: NotificationDestinationSource,
): ResolvedNotificationRoute | null {
  const candidate = {
    type: FEED_NOTIFICATION_TYPES.has(source.type) ? 'FEED' : source.type,
    todoId: source.context?.todoId,
    nudgeId: source.context?.nudgeId,
    friendId: source.context?.friendId,
    commentId: source.routing?.commentId,
    todoOwnerId: source.routing?.todoOwnerId,
    todoDate: source.routing?.todoDate,
  };
  const result = routingSchema.safeParse(candidate);

  return result.success ? result.data : null;
}

function toExternalDestination(kind: 'browser' | 'webview', url?: string): NotificationDestination {
  return url != null && /^https?:\/\//.test(url) ? { kind, url } : NO_DESTINATION;
}

function toRouteDestination(
  routing: ResolvedNotificationRoute,
  { today, windowSizeClass, viewerId }: NotificationDestinationOptions,
): NotificationDestination {
  const toTodoFeed = (target: TodoTarget) => toTodoFeedTarget(target, viewerId);
  const feedDate = today ? 'today' : undefined;
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

/**
 * 알림에서 할 일 상세를 여는 곳. 목록에서 고를 때와 같은 기준으로
 * 접힌 화면은 상세 화면을 push하고, 펼친 화면은 피드 상세 pane에 고른다.
 * 펼친 화면의 목록 pane은 그 할 일의 주인(친구 피드)과 날짜를 보여 준다.
 */
function toTodoDetailRoute(
  windowSizeClass: WindowSizeClass,
  { todoId, comment, friendId, date }: TodoDetailTarget,
) {
  if (windowSizeClass === 'compact') {
    return { pathname: '/todo/[todoId]' as const, params: { todoId, comment } };
  }
  return { pathname: '/feed' as const, params: { friendId, date, todoId, comment } };
}

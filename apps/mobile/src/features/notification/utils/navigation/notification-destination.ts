import {
  NOTIFICATION_TYPE,
  type NotificationAction,
  type NotificationContext,
  type NotificationRouting,
  type NotificationType,
  todoCommentIdSchema,
} from '@aido/api';
import { myInviteHref } from '@src/features/invite/utils/navigation/invite-href';
import { createFeedHref } from '@src/features/todo/utils/feed-route';
import { createTodoDetailHref } from '@src/features/todo/utils/navigation/todo-detail-href';
import type { WindowSizeClass } from '@src/shared/utils/window-size-class';
import type { Href } from 'expo-router';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

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

const routingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(NOTIFICATION_TYPE.TODO_SHARED),
    todoId: z.number().int().positive(),
    commentId: todoCommentIdSchema.optional().catch(undefined),
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
}

export function resolveNotificationDestination(
  source: NotificationDestinationSource,
  { today, windowSizeClass }: NotificationDestinationOptions,
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

  const routing = parseNotificationRouting(source);
  return routing == null ? NO_DESTINATION : toRouteDestination(routing, { today, windowSizeClass });
}

/** 공지의 앱 경로는 아는 화면만 연다. 모르는 경로, 상세 id·프리미엄 확인이 필요한 경로는 이동하지 않는다. */
function toNoticeDestination(url: string | undefined, today?: string): NotificationDestination {
  const feedDate = today ? 'today' : undefined;
  return match(url)
    .with('/feed', () => ({ kind: 'route' as const, href: createFeedHref({ date: feedDate }) }))
    .with('/friends/invite', () => ({ kind: 'route' as const, href: myInviteHref() }))
    .with(
      '/achievements',
      '/weather',
      '/friends',
      '/settings/subscription',
      '/settings/notifications',
      (href) => ({
        kind: 'route' as const,
        href,
      }),
    )
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
  };
  const result = routingSchema.safeParse(candidate);

  return result.success ? result.data : null;
}

function toExternalDestination(kind: 'browser' | 'webview', url?: string): NotificationDestination {
  return url != null && /^https?:\/\//.test(url) ? { kind, url } : NO_DESTINATION;
}

function toRouteDestination(
  routing: ResolvedNotificationRoute,
  { today, windowSizeClass }: NotificationDestinationOptions,
): NotificationDestination {
  const feedDate = today ? 'today' : undefined;
  return match(routing)
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
    .with({ type: P.union('NUDGE_RECEIVED', 'TODO_REMINDER'), todoId: P.number }, ({ todoId }) => ({
      kind: 'route' as const,
      href: createTodoDetailHref(windowSizeClass, { todoId }),
    }))
    .with({ type: 'NUDGE_RECEIVED', friendId: P.string }, ({ friendId }) => ({
      kind: 'route' as const,
      href: createFeedHref({ friendId, date: feedDate }),
    }))
    .with({ type: P.union('NUDGE_RECEIVED', 'TODO_REMINDER') }, () => ({
      kind: 'route' as const,
      href: createFeedHref({ date: feedDate }),
    }))
    .with({ type: P.union('WEATHER_MORNING', 'WEATHER_EVENING') }, () => ({
      kind: 'route' as const,
      href: '/weather' as const,
    }))
    .with({ type: 'TODO_SHARED', commentId: P.string }, ({ todoId, commentId }) => ({
      kind: 'route' as const,
      href: createTodoDetailHref(windowSizeClass, { todoId, comment: commentId }),
    }))
    .with({ type: 'TODO_SHARED' }, ({ todoId }) => ({
      kind: 'route' as const,
      href: createTodoDetailHref(windowSizeClass, { todoId }),
    }))
    .with(
      {
        type: P.union('FOLLOW_ACCEPTED', 'CHEER_RECEIVED', 'FRIEND_COMPLETED', 'NUDGE_SUGGEST'),
      },
      ({ friendId }) => ({
        kind: 'route' as const,
        href: createFeedHref({ friendId, date: feedDate }),
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
    .with({ type: P.union('INVITE_JOINED', 'INVITE_REWARDED') }, () => ({
      kind: 'route' as const,
      href: myInviteHref(),
    }))
    .with({ type: 'PREMIUM_GRANT_ENDING' }, () => ({
      kind: 'route' as const,
      href: '/settings/subscription' as const,
    }))
    .with({ type: 'FEED' }, () => ({
      kind: 'route' as const,
      href: createFeedHref({ date: feedDate }),
    }))
    .exhaustive();
}

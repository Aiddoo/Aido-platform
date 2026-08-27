import {
  NOTIFICATION_TYPE,
  type NotificationAction,
  type NotificationContext,
  type NotificationType,
  todoCommentIdSchema,
} from '@aido/validators';
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
  routing?: Record<string, unknown>;
  action?: NotificationAction;
}

const routingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(NOTIFICATION_TYPE.TODO_SHARED),
    todoId: z.number(),
    commentId: todoCommentIdSchema.optional(),
  }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_NEW) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_ACCEPTED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.CHEER_RECEIVED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FRIEND_COMPLETED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.NUDGE_RECEIVED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.NUDGE_SUGGEST), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_ACHIEVEMENT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.MONTHLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.AI_SUGGESTION) }),
  z.object({ type: z.literal('FEED') }),
]);

type NotificationRouting = z.infer<typeof routingSchema>;

const FEED_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NOTIFICATION_TYPE.TODO_REMINDER,
  NOTIFICATION_TYPE.DAILY_COMPLETE,
  NOTIFICATION_TYPE.MORNING_REMINDER,
  NOTIFICATION_TYPE.EVENING_REMINDER,
  NOTIFICATION_TYPE.WINBACK,
  NOTIFICATION_TYPE.SOCIAL_DIGEST,
  NOTIFICATION_TYPE.LUNCH_NUDGE,
  NOTIFICATION_TYPE.STREAK_AT_RISK,
  NOTIFICATION_TYPE.WEATHER_MORNING,
  NOTIFICATION_TYPE.WEATHER_EVENING,
]);

const NO_DESTINATION: NotificationDestination = { kind: 'none' };

export function resolveNotificationDestination(
  source: NotificationDestinationSource,
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

  const routing = parseNotificationRouting(source);
  return routing === null ? NO_DESTINATION : toRouteDestination(routing);
}

function parseNotificationRouting(
  source: NotificationDestinationSource,
): NotificationRouting | null {
  const candidate = {
    type: FEED_NOTIFICATION_TYPES.has(source.type) ? 'FEED' : source.type,
    ...source.context,
    ...source.routing,
  };
  const result = routingSchema.safeParse(candidate);

  return result.success ? result.data : null;
}

function toExternalDestination(kind: 'browser' | 'webview', url?: string): NotificationDestination {
  return url !== undefined && /^https?:\/\//.test(url) ? { kind, url } : NO_DESTINATION;
}

function toRouteDestination(routing: NotificationRouting): NotificationDestination {
  return match(routing)
    .with({ type: 'TODO_SHARED', commentId: P.string }, ({ todoId, commentId }) => ({
      kind: 'route' as const,
      href: {
        pathname: '/todo/[todoId]' as const,
        params: { todoId, comment: commentId },
      },
    }))
    .with({ type: 'TODO_SHARED' }, ({ todoId }) => ({
      kind: 'route' as const,
      href: { pathname: '/todo/[todoId]' as const, params: { todoId } },
    }))
    .with(
      {
        type: P.union(
          'FOLLOW_ACCEPTED',
          'CHEER_RECEIVED',
          'FRIEND_COMPLETED',
          'NUDGE_RECEIVED',
          'NUDGE_SUGGEST',
        ),
      },
      ({ friendId }) => ({
        kind: 'route' as const,
        href: { pathname: '/feed/friend/[friendId]' as const, params: { friendId } },
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
    .with({ type: 'FEED' }, () => ({ kind: 'route' as const, href: '/feed' as const }))
    .exhaustive();
}

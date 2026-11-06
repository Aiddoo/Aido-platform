import { dateSchema } from '@aido/api';
import type { Href } from 'expo-router';
import { match } from 'ts-pattern';
import { z } from 'zod';

const widgetFeedParametersSchema = z.strictObject({
  date: z.union([dateSchema, z.literal('today')]),
  action: z.literal('add-todo').optional(),
});

const widgetNavigationDestinationSchema = z.discriminatedUnion('kind', [
  widgetFeedParametersSchema.extend({ kind: z.literal('feed') }),
  z.object({ kind: z.literal('todo'), todoId: z.string() }),
]);
export type WidgetNavigationDestination = z.infer<typeof widgetNavigationDestinationSchema>;

/** URI는 원시값으로만 해석한다. Router·현재 계정·시계는 호출자가 제공한다. */
export function parseWidgetNavigationUri(uri: string | null): WidgetNavigationDestination | null {
  if (!uri) {
    return null;
  }

  try {
    const parsed = new URL(uri);
    if (!['aido:', 'aido-dev:', 'aido-preview:'].includes(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password || parsed.hash || parsed.port) {
      return null;
    }

    const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    if (path === '/feed') {
      const parameterKeys = [...parsed.searchParams.keys()];
      if (new Set(parameterKeys).size !== parameterKeys.length) {
        return null;
      }
      const parameters = Object.fromEntries(parsed.searchParams);
      const result = widgetFeedParametersSchema.safeParse(parameters);
      return result.success ? { kind: 'feed', ...result.data } : null;
    }

    const todoId = /^\/todo\/([1-9]\d*)$/.exec(path)?.[1];
    return todoId && !parsed.search && Number.isSafeInteger(Number(todoId))
      ? { kind: 'todo', todoId }
      : null;
  } catch {
    return null;
  }
}

export const widgetNavigationCommandSchema = z.object({
  id: z.string().min(1),
  uri: z.string().refine((uri) => parseWidgetNavigationUri(uri) != null),
  userId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type WidgetNavigationCommand = z.infer<typeof widgetNavigationCommandSchema>;

export const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

const isTimestampWithinTtl = (createdAt: number, now: number, ttl: number): boolean =>
  Number.isFinite(now) && createdAt <= now && now - createdAt < ttl;

const isSameAccount = (ownerId: string, userId: string): boolean => ownerId === userId;

function isFreshWidgetNavigationCommand(
  command: Pick<WidgetNavigationCommand, 'createdAt'>,
  now: number,
): boolean {
  return isTimestampWithinTtl(command.createdAt, now, WIDGET_NAVIGATION_COMMAND_TTL_MS);
}

function isWidgetNavigationCommandOwnedBy(
  command: Pick<WidgetNavigationCommand, 'userId'>,
  userId: string,
): boolean {
  return isSameAccount(command.userId, userId);
}

function isSameWidgetNavigationCommand(
  first: WidgetNavigationCommand,
  second: WidgetNavigationCommand,
): boolean {
  return (
    first.id === second.id &&
    first.uri === second.uri &&
    first.userId === second.userId &&
    first.createdAt === second.createdAt
  );
}

function getWidgetRoute(uri: string | null): Href | null {
  const destination = parseWidgetNavigationUri(uri);
  if (!destination) {
    return null;
  }
  return match(destination)
    .with({ kind: 'todo' }, ({ todoId }): Href => ({
      pathname: '/todo/[todoId]',
      params: { todoId },
    }))
    .with({ kind: 'feed' }, ({ date, action }): Href => ({
      pathname: '/feed',
      params: { date, ...(action && { action }) },
    }))
    .exhaustive();
}

/** Linking이 이미 표시한 목적지는 bootstrap에서 다시 이동하지 않는다. */
function isWidgetRouteCurrent(
  uri: string,
  pathname: string,
  { date, action, friendId }: { date?: string; action?: string; friendId?: string },
): boolean {
  const destination = parseWidgetNavigationUri(uri);
  if (!destination) {
    return false;
  }
  return match(destination)
    .with({ kind: 'todo' }, ({ todoId }) => pathname === `/todo/${todoId}`)
    .with(
      { kind: 'feed' },
      (feed) =>
        pathname === '/feed' &&
        friendId == null &&
        feed.date === (date ?? 'today') &&
        feed.action === action,
    )
    .exhaustive();
}

export const WidgetNavigationPolicy = {
  getRoute: getWidgetRoute,
  isCurrentRoute: isWidgetRouteCurrent,
  isFresh: isFreshWidgetNavigationCommand,
  isOwnedBy: isWidgetNavigationCommandOwnedBy,
  isSameCommand: isSameWidgetNavigationCommand,
} as const;

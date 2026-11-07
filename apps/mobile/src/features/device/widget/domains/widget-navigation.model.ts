import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import {
  parseWidgetNavigationUri,
  type WidgetNavigationCommand,
} from '../schemas/widget-navigation.schema';

export const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

function isFresh(command: Pick<WidgetNavigationCommand, 'createdAt'>, now: number): boolean {
  return (
    Number.isFinite(now) &&
    command.createdAt <= now &&
    now - command.createdAt < WIDGET_NAVIGATION_COMMAND_TTL_MS
  );
}

function isOwnedBy(command: Pick<WidgetNavigationCommand, 'userId'>, userId: string): boolean {
  return command.userId === userId;
}

function isSameCommand(first: WidgetNavigationCommand, second: WidgetNavigationCommand): boolean {
  return (
    first.id === second.id &&
    first.uri === second.uri &&
    first.userId === second.userId &&
    first.createdAt === second.createdAt
  );
}

function getRoute(uri: string | null): Href | null {
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
function isCurrentRoute(
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
  getRoute,
  isCurrentRoute,
  isFresh,
  isOwnedBy,
  isSameCommand,
} as const;

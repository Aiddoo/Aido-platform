import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import {
  parseWidgetNavigationUri,
  type WidgetNavigationCommand,
} from '../schemas/widget-navigation.schema';

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

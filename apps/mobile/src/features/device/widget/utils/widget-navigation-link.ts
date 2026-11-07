import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import { parseWidgetNavigationUri } from '../schemas/widget-navigation.schema';

export function getWidgetRoute(uri: string | null): Href | null {
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
export function isWidgetRouteShown(
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

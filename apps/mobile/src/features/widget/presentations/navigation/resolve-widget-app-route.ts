import type { Href } from 'expo-router';

import { parseWidgetNavigationUri } from '../../models/widget-navigation.model';

export function resolveWidgetAppRoute(url: string | null): Href | null {
  const destination = parseWidgetNavigationUri(url);
  if (!destination) return null;
  if (destination.kind === 'todo') {
    return { pathname: '/todo/[todoId]', params: { todoId: destination.todoId } };
  }
  return {
    pathname: '/feed',
    params: { date: destination.date, ...(destination.action && { action: destination.action }) },
  };
}

/** Linking이 이미 표시한 목적지는 bootstrap에서 다시 이동하지 않는다. */
export function isWidgetAppRouteCurrent(
  uri: string,
  pathname: string,
  { date, action }: { date?: string | string[]; action?: string | string[] },
): boolean {
  const destination = parseWidgetNavigationUri(uri);
  if (!destination) return false;
  if (destination.kind === 'todo') return pathname === `/todo/${destination.todoId}`;

  return (
    pathname === '/feed' && destination.date === (date ?? 'today') && destination.action === action
  );
}

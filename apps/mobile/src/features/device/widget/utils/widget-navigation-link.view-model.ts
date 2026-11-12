import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import { parseWidgetNavigationUri } from '../domains/widget-navigation.model';

export function findWidgetRoute(uri: string | null): Href | null {
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

/** Android 위젯이 명령을 저장한 뒤 앱을 깨우는 링크. iOS 위젯 본문 링크와 모양이 같다 */
export function isWidgetWakeLink(uri: string): boolean {
  const destination = parseWidgetNavigationUri(uri);
  return destination?.kind === 'feed' && destination.date === 'today' && destination.action == null;
}

/** 분석에 남기는 위젯 목적지. 만들기는 피드 위 시트라 따로 센다 */
export function getWidgetOpenedDestination(uri: string | null) {
  const destination = parseWidgetNavigationUri(uri);
  if (!destination) {
    return null;
  }
  return match(destination)
    .with({ kind: 'todo' }, () => 'todo' as const)
    .with({ kind: 'feed', action: 'add-todo' }, () => 'add_todo' as const)
    .with({ kind: 'feed' }, () => 'feed' as const)
    .exhaustive();
}

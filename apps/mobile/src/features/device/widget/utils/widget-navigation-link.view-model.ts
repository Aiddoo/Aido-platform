import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import { parseWidgetNavigationUri } from '../domains/widget-navigation.model';

interface ShownRoute {
  pathname: string;
  params: { date?: string; action?: string; friendId?: string };
}

/** 위젯 목적지 하나를 앱이 어떻게 여는가. 분석 값은 만들기를 피드와 따로 센다 */
interface WidgetEntry {
  href: Href;
  openedDestination: 'todo' | 'feed' | 'add_todo';
  /** Linking이 이미 표시한 목적지면 bootstrap에서 다시 이동하지 않는다 */
  isShown: (current: ShownRoute) => boolean;
}

/**
 * 위젯 URI를 앱 진입으로 바꾼다. 새 목적지는 `widgetNavigationDestinationSchema`에 항목 하나, 아래 `match`에 한 줄이다.
 * 허용하지 않거나 손상된 URI는 null이다
 */
export function findWidgetEntry(uri: string | null): WidgetEntry | null {
  const destination = parseWidgetNavigationUri(uri);
  if (destination == null) {
    return null;
  }
  return match(destination)
    .with({ kind: 'todo' }, ({ todoId }) => ({
      href: { pathname: '/todo/[todoId]', params: { todoId } } satisfies Href,
      openedDestination: 'todo' as const,
      isShown: ({ pathname }: ShownRoute) => pathname === `/todo/${todoId}`,
    }))
    .with({ kind: 'feed' }, ({ date, action }) => ({
      href: { pathname: '/feed', params: { date, ...(action && { action }) } } satisfies Href,
      openedDestination: action === 'add-todo' ? ('add_todo' as const) : ('feed' as const),
      isShown: ({ pathname, params }: ShownRoute) =>
        pathname === '/feed' &&
        params.friendId == null &&
        date === (params.date ?? 'today') &&
        action === params.action,
    }))
    .exhaustive();
}

/** Android 위젯이 명령을 저장한 뒤 앱을 깨우는 링크. iOS 위젯 본문 링크와 모양이 같다 */
export function isWidgetWakeLink(uri: string): boolean {
  const destination = parseWidgetNavigationUri(uri);
  return destination?.kind === 'feed' && destination.date === 'today' && destination.action == null;
}

import type { Href } from 'expo-router';
import { match } from 'ts-pattern';

import type { WidgetNavigationDestination } from '../domains/widget-navigation.model';
import { widgetNavigationUriSchema } from '../schemas/widget-navigation-payload.schema';

export function parseWidgetNavigation(uri: string | null): WidgetNavigationDestination | null {
  if (!uri) {
    return null;
  }
  return widgetNavigationUriSchema.safeParse(uri).data ?? null;
}

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

/** 목적지를 라우터 주소·분석 값·지금 화면과의 대조로 바꾼다. 새 목적지는 스키마 항목 하나와 아래 `match` 한 줄이다 */
export function toWidgetEntry(destination: WidgetNavigationDestination): WidgetEntry {
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

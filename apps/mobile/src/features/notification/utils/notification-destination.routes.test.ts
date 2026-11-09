import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import type { Href } from 'expo-router';

import { NAVIGATION_CASES } from '../__tests__/notification-navigation-cases';
import { resolveNotificationDestination } from './notification-destination';

const APP_DIRECTORY = join(__dirname, '../../../../app');
const ROUTE_GROUP = /^\(.+\)$/;
const WINDOW_SIZE_CLASSES: readonly WindowSizeClass[] = ['compact', 'expanded'];
const CONTEXT = { todoId: 1, nudgeId: 1, friendId: 'friend-1' };

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findRouteFiles(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

/** 라우트 파일을 URL 모양으로 바꾼다. 그룹 폴더와 index는 URL에 없다. */
function getRoutePathnames(): Set<string> {
  const pathnames = findRouteFiles(APP_DIRECTORY)
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('_layout.tsx'))
    .map((file) => {
      const segments = relative(APP_DIRECTORY, file)
        .replace(/\.tsx$/, '')
        .split(sep)
        .filter((segment) => !ROUTE_GROUP.test(segment) && segment !== 'index');
      return `/${segments.join('/')}`;
    });

  return new Set(pathnames);
}

function getHrefPathname(href: Href): string | undefined {
  const pathname = typeof href === 'string' ? href : href.pathname;

  return pathname?.split('?')[0];
}

function getRouteDestinationPathnames(
  destinations: readonly ReturnType<typeof resolveNotificationDestination>[],
): (string | undefined)[] {
  return destinations.flatMap((destination) =>
    destination.kind === 'route' ? [getHrefPathname(destination.href)] : [],
  );
}

describe('알림 목적지와 라우트 파일', () => {
  const routePathnames = getRoutePathnames();

  it.each(Object.values(NOTIFICATION_TYPE))('%s 알림의 목적지는 있는 화면이다', (type) => {
    // When
    const destinations = WINDOW_SIZE_CLASSES.map((windowSizeClass) =>
      resolveNotificationDestination(
        { type, context: CONTEXT, action: { type: 'DEEP_LINK' } },
        { windowSizeClass, shouldOpenToday: true },
      ),
    );

    // Then
    getRouteDestinationPathnames(destinations).forEach((pathname) => {
      expect(routePathnames).toContain(pathname);
    });
  });

  it.each(
    NAVIGATION_CASES.flatMap(({ name, navigation }) =>
      navigation == null ? [] : [{ name, navigation }],
    ),
  )('$name: 서버 navigation의 목적지는 있는 화면이다', ({ navigation }) => {
    // When
    const destinations = WINDOW_SIZE_CLASSES.map((windowSizeClass) =>
      resolveNotificationDestination(
        { type: null, navigation },
        { windowSizeClass, shouldOpenToday: true },
      ),
    );

    // Then
    getRouteDestinationPathnames(destinations).forEach((pathname) => {
      expect(routePathnames).toContain(pathname);
    });
  });

  it('모르는 타입의 목적지는 있는 화면이다', () => {
    // When
    const destination = resolveNotificationDestination(
      { type: null },
      { windowSizeClass: 'compact' },
    );

    // Then
    expect(destination.kind === 'route' && getHrefPathname(destination.href)).toBe(
      '/notifications',
    );
    expect(routePathnames).toContain('/notifications');
  });

  it.each(Object.values(NOTICE_DEEP_LINK_PATH))('공지 경로 %s는 있는 화면이다', (url) => {
    // When
    const destination = resolveNotificationDestination(
      { type: NOTIFICATION_TYPE.SYSTEM_NOTICE, action: { type: 'DEEP_LINK', url } },
      { windowSizeClass: 'compact', shouldOpenToday: true },
    );

    // Then
    expect(destination.kind).toBe('route');
    const [pathname] = getRouteDestinationPathnames([destination]);
    expect(routePathnames).toContain(pathname);
  });
});

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { useOpenSubscriptionInquiry } from '@src/features/billing/subscription/hooks/use-open-subscription-inquiry';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { QueryErrorActions } from '@src/shared/ui';
import { useSheetRoute } from '@src/shared/ui/bottom-sheet/use-sheet-route';
import { stubWindowDimensions } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { router, Stack, Tabs } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import * as MyPageTabLayout from '../../../app/(app)/(tabs)/(me)/_layout';
import * as MemoTabLayout from '../../../app/(app)/(tabs)/(memos)/_layout';
import * as FeedTabLayout from '../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';
import * as NativeIntent from '../../../app/+native-intent';
import { clearColdStartPath } from './cold-start-link';

// 실제 라우터로 URL·탭·뒤로 가기 목적지를 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

type SystemUrlListener = (event: { url: string }) => void;

// expo-router 시험 도구는 OS 링크 구독을 빈 함수로 막는다. 켜진 앱에 들어오는 링크를 흘릴 수 있게 구독을 모은다
const systemUrlListeners = new Set<SystemUrlListener>();
Object.assign(jest.requireMock<Record<string, unknown>>('expo-linking'), {
  addEventListener: (_type: 'url', listener: SystemUrlListener) => {
    systemUrlListeners.add(listener);
    return { remove: () => systemUrlListeners.delete(listener) };
  },
});

const SHARED_TAB_DIRECTORY = join(__dirname, '../../../app/(app)/(tabs)/(me,memos,todos)');

/** 탭마다 함께 쓰는 화면 파일. 화면을 더해도 이 테스트를 고치지 않게 폴더에서 읽는다 */
const SHARED_ROUTES = findRouteFiles(SHARED_TAB_DIRECTORY)
  .filter((file) => !file.endsWith('_layout.tsx'))
  .map((file) =>
    relative(SHARED_TAB_DIRECTORY, file)
      .replace(/\.tsx$/, '')
      .split(sep)
      .join('/'),
  );

/** 1.15.1까지 공개한 탭 첫 화면 경로와 그 탭. 푸시·위젯·링크·기기에 남은 href가 쓰는 외부 계약이라 줄을 지우거나 바꾸지 않는다 */
const PUBLIC_TAB_ROOT_PATHS = [
  ['/feed?date=today', 'feed', '(todos)'],
  ['/memo', 'memo', '(memos)'],
  ['/mypage', 'mypage/index', '(me)'],
] as const;

/**
 * 1.15.1까지 공개한, 탭마다 함께 쓰는 화면 경로. 외부 계약이라 줄을 지우거나 바꾸지 않는다.
 * 앱 밖에서 열면 1.15.1처럼 이 화면을 가진 마이 탭에 열리고 뒤로 가면 내 정보 메뉴다
 */
const PUBLIC_SHARED_TAB_PATHS = [
  ['/friends?view=receiver', 'friends/index'],
  ['/friends/search', 'friends/search'],
  ['/friends/add', 'friends/add'],
  ['/friends/invite', 'friends/invite/index'],
  ['/friends/invite/invitees?view=all', 'friends/invite/invitees'],
  ['/achievements', 'achievements/index'],
  ['/achievements/2026/45', 'achievements/[year]/[week]'],
  ['/reports', 'reports/index'],
  ['/reports/report-1', 'reports/[reportId]'],
  ['/whats-new/releases', 'whats-new/releases'],
  ['/settings/notifications', 'settings/notifications/index'],
  ['/settings/notifications/push', 'settings/notifications/push'],
  ['/settings/notifications/weather', 'settings/notifications/weather'],
  ['/settings/notifications/reminder', 'settings/notifications/reminder'],
  ['/settings/blocked-users', 'settings/blocked-users'],
  ['/settings/category-settings', 'settings/category-settings'],
  ['/settings/theme', 'settings/theme'],
  ['/settings/font-size', 'settings/font-size'],
  ['/settings/language', 'settings/language'],
  ['/settings/voice-storage', 'settings/voice-storage'],
  ['/settings/subscription?feature=AI_REPORT', 'settings/subscription'],
  ['/settings/app-icon', 'settings/app-icon'],
  ['/settings/inquiry?category=PAYMENT', 'settings/inquiry'],
  ['/settings/terms', 'settings/terms'],
  ['/settings/profile', 'settings/profile'],
  ['/settings/edit-name', 'settings/edit-name'],
  ['/settings/change-password', 'settings/change-password'],
  ['/settings/linked-accounts', 'settings/linked-accounts'],
  ['/settings/delete-account', 'settings/delete-account'],
] as const;

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

interface StateRoute {
  name: string;
  state?: { routes: readonly StateRoute[] };
}

/** 탭 묶음(`(tabs)`)이 Stack에 몇 겹 있는지. 탭 위 화면에서 탭 화면을 잘못 열면 두 겹이 된다 */
function countTabBundles(routes: readonly StateRoute[]): number {
  return routes.reduce(
    (count, route) =>
      count + (route.name === '(tabs)' ? 1 : 0) + countTabBundles(route.state?.routes ?? []),
    0,
  );
}

function MemoScreen() {
  return (
    <>
      <Text testID="memo">memo</Text>
      <QueryErrorActions.Inquiry />
    </>
  );
}

function PaywallScreen() {
  const openSubscriptionInquiry = useOpenSubscriptionInquiry();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          openSubscriptionInquiry({
            titleKey: 'subscription:failure.title.storeUnavailable',
            diagnosticCode: 'SUB-TEST',
          })
        }
      >
        <Text>결제 문의</Text>
      </Pressable>
      <QueryErrorActions.Inquiry />
    </>
  );
}

/** 문의하기가 있는 route 시트(시트, 연 화면, 문의에서 뒤로 가면 나올 화면). 문의는 탭 화면이라 `dismiss-to`로 떠나야 탭 묶음이 한 겹이다 */
const INQUIRY_SHEETS = [
  ['/todo/new', '/feed', '/mypage'],
  ['/todo/1/edit', '/feed', '/mypage'],
  ['/todo/1/actions', '/feed', '/mypage'],
  ['/todo/1/actions', '/todo/1', '/mypage'],
  ['/todo/1/date', '/feed', '/mypage'],
  ['/todo/1/time', '/feed', '/mypage'],
  ['/todo/1/category', '/feed', '/mypage'],
  ['/todo/1/sub-todos/2/actions', '/feed', '/mypage'],
  ['/todo-categories/3/edit', '/settings/category-settings', '/settings/category-settings'],
  ['/todo-categories/3/delete', '/settings/category-settings', '/settings/category-settings'],
  ['/suggestions/4/category', '/suggestions', '/mypage'],
  ['/weather/reschedule', '/weather', '/mypage'],
] as const;

function InquirySheet() {
  const sheet = useSheetRoute('/feed');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => sheet.exit({ type: 'dismiss-to', href: '/settings/inquiry' })}
    >
      <Text>시트 문의</Text>
    </Pressable>
  );
}

function FeedScreen() {
  const openMyInvite = useOpenMyInvite();

  return (
    <Pressable accessibilityRole="button" onPress={() => openMyInvite('friend_strip_empty')}>
      <Text testID="feed">초대하기</Text>
    </Pressable>
  );
}

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findRouteFiles(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

/** route 파일 이름을 그 화면을 여는 URL로 바꾼다(`reports/[reportId]` → `/reports/sample`) */
function toSampleUrl(routeName: string) {
  const segments = routeName
    .split('/')
    .filter((segment) => segment !== 'index')
    .map((segment) => segment.replace(/^\[.+\]$/, 'sample'));
  return `/${segments.join('/')}`;
}

function toPathname(url: string) {
  return url.split('?')[0];
}

async function renderApp(initialUrl: string) {
  const sharedScreens = Object.fromEntries(
    SHARED_ROUTES.map((name) => [`(app)/(tabs)/(me,memos,todos)/${name}`, createScreen(name)]),
  );
  const routes = {
    '+native-intent': NativeIntent,
    _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    '(app)/_layout': {
      default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      unstable_settings: { anchor: '(tabs)' },
    },
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다. NativeTabs처럼 처음부터 모든 탭을 띄운다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false, lazy: false }}>
          <Tabs.Screen name="(todos)" options={{ tabBarButtonTestID: 'tab-feed' }} />
          <Tabs.Screen name="(memos)" options={{ tabBarButtonTestID: 'tab-memo' }} />
          <Tabs.Screen name="(me)" options={{ tabBarButtonTestID: 'tab-mypage' }} />
        </Tabs>
      ),
      unstable_settings: tabsSettings,
    },
    '(app)/(tabs)/(todos)/_layout': FeedTabLayout,
    '(app)/(tabs)/(memos)/_layout': MemoTabLayout,
    '(app)/(tabs)/(me)/_layout': MyPageTabLayout,
    '(app)/(tabs)/(todos)/feed/index': FeedScreen,
    '(app)/(tabs)/(memos)/memo/index': MemoScreen,
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage/index'),
    ...sharedScreens,
    '(app)/todo/[todoId]/index': createScreen('todo'),
    '(app)/whats-new/index': createScreen('whats-new'),
    '(app)/paywall': PaywallScreen,
    '(app)/todo/new': InquirySheet,
    '(app)/todo/[todoId]/edit': InquirySheet,
    '(app)/todo/[todoId]/actions': InquirySheet,
    '(app)/todo/[todoId]/date': InquirySheet,
    '(app)/todo/[todoId]/time': InquirySheet,
    '(app)/todo/[todoId]/category': InquirySheet,
    '(app)/todo/[todoId]/sub-todos/[subTodoId]/actions': InquirySheet,
    '(app)/todo-categories/[categoryId]/edit': InquirySheet,
    '(app)/todo-categories/[categoryId]/delete': InquirySheet,
    '(app)/suggestions/index': createScreen('suggestions'),
    '(app)/suggestions/[suggestionId]/category': InquirySheet,
    '(app)/weather/reschedule': InquirySheet,
    '(app)/weather/_layout': () => (
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    ),
    '(app)/weather/index': createScreen('weather'),
    '(app)/weather/settings': createScreen('weather/settings'),
  };

  // Metro는 route 파일을 경로 순으로 올리고, 탭이 정해지지 않은 링크가 고르는 그룹이 이 순서를 따른다. 같은 순서로 올린다
  return renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url: initialUrl },
  );
}

describe('탭 Stack 라우팅', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
  });

  describe('탭 안에서 연 화면은 누른 탭에 쌓인다', () => {
    it('할 일 탭에서 초대하기를 누르고 뒤로 가면 할 일 탭이다', async () => {
      // Given
      const route = await renderApp('/feed');
      // 첫 렌더가 끝나야 router가 준비된다. 다시 그려져야 버튼이 쥔 push가 실제 push로 바뀐다
      await act(() => router.setParams({ date: 'today' }));

      // When
      await act(async () => fireEvent.press(screen.getByRole('button', { name: '초대하기' })));

      // Then
      expect(route.getPathname()).toBe('/friends/invite');
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'invite']);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'feed']);
      expect(route.getSearchParams()).toEqual({ date: 'today' });
    });

    it('할 일 탭에서 더 들어가도(친구 찾기 → 친구 추가) 할 일 탭에 쌓이고 차례로 돌아온다', async () => {
      // Given
      const route = await renderApp('/feed');

      // When
      await act(() => router.push('/friends/search'));
      await act(() => router.navigate('/friends/add'));

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'add']);

      // When
      await act(() => router.back());

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'search']);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
    });

    it('메모 탭에서 연 탭 화면은 메모 탭에 쌓이고 뒤로 가면 메모다', async () => {
      // Given
      const route = await renderApp('/memo');

      // When
      await act(() => router.push('/settings/subscription'));

      // Then
      expect(route.getSegments()).toEqual([
        '(app)',
        '(tabs)',
        '(memos)',
        'settings',
        'subscription',
      ]);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/memo');
    });

    it('탭 안 오류 문의는 그 탭에 쌓고 뒤로 가면 보던 화면이다', async () => {
      // Given
      const route = await renderApp('/memo');

      // When
      await act(async () => fireEvent.press(screen.getByTestId('query-error-inquiry')));

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(memos)', 'settings', 'inquiry']);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/memo');
    });

    it('마이 탭에서 연 화면은 마이 탭에 쌓이고 뒤로 가면 내 정보 메뉴다', async () => {
      // Given
      const route = await renderApp('/mypage');

      // When
      await act(() => router.push('/settings/notifications'));
      await act(() => router.push('/settings/notifications/push'));

      // Then
      expect(route.getSegments()).toEqual([
        '(app)',
        '(tabs)',
        '(me)',
        'settings',
        'notifications',
        'push',
      ]);

      // When
      await act(() => router.back());
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/mypage');
    });

    it('다른 탭에 갔다 돌아오면 그 탭에 쌓아 둔 화면이 그대로다', async () => {
      // Given
      const route = await renderApp('/feed');
      await act(() => router.push('/friends/invite'));

      // When
      await act(async () => fireEvent.press(screen.getByTestId('tab-mypage')));

      // Then
      expect(route.getPathname()).toBe('/mypage');

      // When
      await act(async () => fireEvent.press(screen.getByTestId('tab-feed')));

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'invite']);
    });
  });

  it('탭 첫 화면으로 가면 그 탭으로 바뀐다(마이 탭 친구 목록 → 친구 피드)', async () => {
    // Given
    const route = await renderApp('/mypage');
    await act(() => router.push('/friends'));

    // When
    await act(() => router.navigate({ pathname: '/feed', params: { friendId: 'friend-1' } }));

    // Then
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'feed']);
    expect(route.getSearchParams()).toEqual({ friendId: 'friend-1' });

    // When
    await act(async () => fireEvent.press(screen.getByTestId('tab-mypage')));

    // Then
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'friends']);
  });

  describe('꺼진 앱으로 들어온 링크(콜드)는 화면을 가진 탭에 열고 그 탭 첫 화면을 아래에 둔다', () => {
    afterEach(clearColdStartPath);

    it.each(PUBLIC_TAB_ROOT_PATHS)(
      '%s는 URL 그대로 그 탭의 첫 화면에 열린다',
      async (url, routeName, tabGroup) => {
        // When
        const route = await renderApp(
          NativeIntent.redirectSystemPath({ path: url, initial: true }),
        );

        // Then
        expect(route.getPathname()).toBe(toPathname(url));
        expect(route.getSegments()[2]).toBe(tabGroup);
        expect(screen.getByTestId(routeName)).toBeTruthy();
      },
    );

    it.each(PUBLIC_SHARED_TAB_PATHS)(
      '%s는 URL 그대로 마이 탭에 열리고 뒤로 가면 내 정보 메뉴다',
      async (url, routeName) => {
        // When
        const route = await renderApp(
          NativeIntent.redirectSystemPath({ path: url, initial: true }),
        );

        // Then
        expect(route.getPathname()).toBe(toPathname(url));
        expect(route.getSegments()[2]).toBe('(me)');
        expect(screen.getByTestId(routeName)).toBeTruthy();

        // When
        await act(() => router.back());

        // Then
        expect(route.getPathname()).toBe('/mypage');
      },
    );

    it.each(SHARED_ROUTES)(
      '함께 쓰는 화면 파일(%s)은 따로 적지 않아도 마이 탭에 열린다',
      async (routeName) => {
        // When
        const route = await renderApp(toSampleUrl(routeName));

        // Then
        expect(route.getSegments()[2]).toBe('(me)');
        expect(screen.getByTestId(routeName)).toBeTruthy();

        // When
        await act(() => router.back());

        // Then
        expect(route.getPathname()).toBe('/mypage');
      },
    );
  });

  it('켜진 앱에 들어온 링크(웜)는 보던 탭 위에 열고 뒤로 가면 보던 화면이다', async () => {
    // Given
    const route = await renderApp('/feed');
    await act(() => router.push('/friends/search'));

    // When
    await act(async () => {
      systemUrlListeners.forEach((listener) => listener({ url: 'aido://friends/invite' }));
    });

    // Then
    expect(route.getPathname()).toBe('/friends/invite');
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'invite']);

    // When
    await act(() => router.back());

    // Then
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(todos)', 'friends', 'search']);
  });

  describe('탭 위 화면은 탭을 새로 쌓지 않고 아래 탭 묶음으로 돌아간다', () => {
    it('결제 모달에서 리포트로 떠나면(dismissTo) 모달을 닫고 리포트를 가진 마이 탭에 연다', async () => {
      // Given
      const route = await renderApp('/memo');
      await act(() => router.push('/paywall'));

      // When
      await act(() => router.dismissTo('/reports'));

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'reports']);
      expect(countTabBundles(route.getRouterState()?.routes ?? [])).toBe(1);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/mypage');
    });

    it('결제 모달에서 연 결제 문의는 모달을 닫고 탭 묶음 하나 안에서 연다', async () => {
      // Given
      const route = await renderApp('/memo');
      await act(() => router.push('/paywall'));

      // When
      await act(async () => fireEvent.press(screen.getByRole('button', { name: '결제 문의' })));

      // Then
      expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'settings', 'inquiry']);
      expect(countTabBundles(route.getRouterState()?.routes ?? [])).toBe(1);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/mypage');
    });

    it('결제 모달의 오류 문의도 탭 묶음을 두 겹 쌓지 않는다', async () => {
      // Given
      const route = await renderApp('/memo');
      await act(() => router.push('/paywall'));

      // When
      await act(async () => fireEvent.press(screen.getByTestId('query-error-inquiry')));

      // Then
      expect(route.getPathname()).toBe('/settings/inquiry');
      expect(countTabBundles(route.getRouterState()?.routes ?? [])).toBe(1);
    });

    it.each(INQUIRY_SHEETS)(
      '%s 시트(%s 위)에서 문의로 떠나면 시트를 닫고 탭 묶음 하나 안에서 연다',
      async (sheetUrl, underUrl, backPathname) => {
        // Given
        const route = await renderApp(underUrl);
        await act(() => router.push(sheetUrl));

        // When
        await act(async () => fireEvent.press(screen.getByRole('button', { name: '시트 문의' })));

        // Then
        expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'settings', 'inquiry']);
        expect(countTabBundles(route.getRouterState()?.routes ?? [])).toBe(1);

        // When
        await act(() => router.back());

        // Then
        expect(route.getPathname()).toBe(backPathname);
      },
    );

    it('할 일 댓글 링크는 탭 위에 열리고 뒤로 가면 할 일 탭이다', async () => {
      // Given
      const route = await renderApp('/todo/42?comment=7');

      // Then
      expect(route.getPathname()).toBe('/todo/42');
      expect(route.getSearchParams()).toMatchObject({ comment: '7' });

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
    });

    it('할 일 탭에서 연 업셀 결제는 탭 위 모달로 열리고 닫으면 할 일 탭 그대로다', async () => {
      // Given
      const route = await renderApp('/feed?date=2026-11-09');

      // When
      await act(() => router.push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } }));

      // Then
      expect(route.getSegments()).toEqual(['(app)', 'paywall']);
      expect(route.getSearchParams()).toEqual({ feature: 'AI_SUGGESTION' });

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(route.getSearchParams()).toEqual({ date: '2026-11-09' });
      expect(router.canGoBack()).toBe(false);
    });

    it('날씨 화면에서 연 날씨 알림 설정은 날씨 Stack에 쌓이고 뒤로 가면 날씨다', async () => {
      // Given
      const route = await renderApp('/feed');
      await act(() => router.push('/weather'));

      // When
      await act(() => router.push('/weather/settings'));

      // Then
      expect(route.getSegments()).toEqual(['(app)', 'weather', 'settings']);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/weather');

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(router.canGoBack()).toBe(false);
    });
  });
});

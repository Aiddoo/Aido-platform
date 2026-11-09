import { stubWindowDimensions, TestUiProvider } from '@src/shared/__tests__';
import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import * as MyPageTabLayout from '../../../app/(app)/(tabs)/(mypage)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';

// 실제 라우터로 URL·탭·뒤로 가기 목적지를 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

const MY_PAGE_ROUTES = [
  'mypage/index',
  'friends/index',
  'friends/search',
  'friends/add',
  'friends/invite/index',
  'friends/invite/invitees',
  'achievements/index',
  'achievements/[year]/[week]',
  'reports/index',
  'reports/[reportId]',
  'whats-new/releases',
  'settings/notifications/index',
  'settings/notifications/push',
  'settings/notifications/weather',
  'settings/notifications/reminder',
  'settings/blocked-users',
  'settings/category-settings',
  'settings/theme',
  'settings/font-size',
  'settings/language',
  'settings/voice-storage',
  'settings/subscription',
  'settings/app-icon',
  'settings/inquiry',
  'settings/terms',
  'settings/profile',
  'settings/edit-name',
  'settings/change-password',
  'settings/linked-accounts',
  'settings/delete-account',
] as const;

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

async function renderApp(initialUrl: string) {
  const myPageScreens = Object.fromEntries(
    MY_PAGE_ROUTES.map((name) => [`(app)/(tabs)/(mypage)/${name}`, createScreen(name)]),
  );

  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      '(app)/_layout': {
        default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
        unstable_settings: { anchor: '(tabs)' },
      },
      // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다. NativeTabs처럼 처음부터 모든 탭을 띄운다
      '(app)/(tabs)/_layout': {
        default: () => (
          <Tabs screenOptions={{ headerShown: false, lazy: false }}>
            <Tabs.Screen name="feed/index" />
            <Tabs.Screen name="memo/index" />
            <Tabs.Screen name="(mypage)" />
          </Tabs>
        ),
        unstable_settings: tabsSettings,
      },
      '(app)/(tabs)/feed/index': createScreen('feed'),
      '(app)/(tabs)/memo/index': createScreen('memo'),
      '(app)/(tabs)/(mypage)/_layout': MyPageTabLayout,
      ...myPageScreens,
      '(app)/todo/[todoId]/index': createScreen('todo'),
      '(app)/whats-new/index': createScreen('whats-new'),
    },
    { initialUrl, wrapper: TestUiProvider },
  );
}

describe('마이 탭 라우팅', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
  });

  it('알림 설정 링크는 URL 그대로 마이 탭 Stack에 열리고 뒤로 가면 내 정보 메뉴다', async () => {
    // Given
    const route = await renderApp('/settings/notifications');

    // Then
    expect(route.getPathname()).toBe('/settings/notifications');
    expect(route.getSegments()).toEqual([
      '(app)',
      '(tabs)',
      '(mypage)',
      'settings',
      'notifications',
    ]);
    expect(screen.getByTestId('settings/notifications/index')).toBeTruthy();

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/mypage');
    expect(screen.getByTestId('mypage/index')).toBeTruthy();
  });

  it('받은 친구 요청 링크는 보기 상태를 지닌 채 마이 탭에 열리고 뒤로 가면 내 정보 메뉴다', async () => {
    // Given
    const route = await renderApp('/friends?view=receiver');

    // Then
    expect(route.getPathname()).toBe('/friends');
    expect(route.getSearchParams()).toEqual({ view: 'receiver' });
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(mypage)', 'friends']);

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/mypage');
  });

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

  it('다른 탭에서 마이 탭 화면을 열면 마이 탭으로 바뀌고 뒤로 가면 내 정보 메뉴다', async () => {
    // Given
    const route = await renderApp('/feed');

    // When
    await act(() => router.push('/friends/search'));

    // Then
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(mypage)', 'friends', 'search']);

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/mypage');
  });

  it('탭 위 화면에서 탭 안 화면으로 떠나면(dismissTo) 탭을 새로 쌓지 않고 기존 탭에서 연다', async () => {
    // Given
    const route = await renderApp('/feed');
    await act(() => router.push('/whats-new'));

    // When
    await act(() => router.dismissTo('/friends/invite'));

    // Then
    expect(route.getSegments()).toEqual(['(app)', '(tabs)', '(mypage)', 'friends', 'invite']);

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/mypage');

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/feed');
    expect(router.canGoBack()).toBe(false);
  });
});

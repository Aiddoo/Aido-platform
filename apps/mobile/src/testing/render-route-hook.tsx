import { ThemeProvider } from '@src/shared/providers/theme-provider';
import type { QueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType, PropsWithChildren } from 'react';
import { Fragment } from 'react';

import type { TestDi } from './di';
import { createTestProviders, type TestProviderOptions } from './render';

// expo-router 시험 도구가 불릴 때 expo-linking을 다시 mock해 jest.setup의 `useLinkingURL` mock이 빠진다. 링크를 정하는 테스트가 쓰도록 다시 붙인다
Object.assign(jest.requireMock<Record<string, unknown>>('expo-linking'), {
  useLinkingURL: jest.fn(() => null),
});

function EmptyScreen() {
  return null;
}

interface RenderRouteHookOptions {
  /** 훅을 돌릴 화면의 주소. 처음 열리는 URL이기도 하다 */
  url: string;
  /** 앞 화면이 있어야 하는 뒤로 가기 확인용. 이 주소를 먼저 열고 `url`로 push한다 */
  from?: string;
  /** push로 이동할 수 있어야 하는 다른 route 파일 */
  routes?: string[];
  /** 훅이 읽는 Provider */
  wrapper?: ComponentType<PropsWithChildren>;
}

/**
 * 진짜 Expo Router 위에서 훅을 돌려 공개 URL이 어떻게 바뀌는지 본다.
 * 쓰는 테스트 파일은 전역 mock을 끄도록 `jest.unmock('expo-router')`를 부른다.
 */
export async function renderRouteHook<T>(
  useHook: () => T,
  { url, from, routes = [], wrapper: Wrapper = Fragment }: RenderRouteHookOptions,
) {
  let latest: { value: T } | undefined;
  const capture = (value: T) => {
    latest = { value };
  };
  function RunHook({ onRender }: { onRender: (value: T) => void }) {
    onRender(useHook());
    return null;
  }
  function HookScreen() {
    return (
      <Wrapper>
        <RunHook onRender={capture} />
      </Wrapper>
    );
  }
  const pathname = url.split('?')[0] ?? url;
  const screens = [...routes, ...(from == null ? [] : [from.replace(/^\//, '')])];
  const rendered = await renderRouter(
    {
      _layout: () => <Stack />,
      [`${pathname.replace(/^\//, '')}/index`]: HookScreen,
      ...Object.fromEntries(screens.map((screen) => [screen, EmptyScreen])),
    },
    { initialUrl: from ?? url },
  );
  if (from != null) {
    // 시험용 route는 타입이 있는 route 목록에 없어 앞 화면 기준 상대 경로로 민다
    await act(async () => router.push(`./${url.slice(1)}`));
  }

  function hook(): T {
    if (latest == null) {
      throw new Error('훅을 돌릴 화면이 아직 그려지지 않았습니다');
    }
    return latest.value;
  }

  return {
    hook,
    /** 값을 지우면 라우터 안에는 `undefined`가 남으므로, 밖에서 보는 URL처럼 그 키를 뺀다 */
    url: () => {
      const [path, query = ''] = rendered.getPathnameWithParams().split('?');
      const pairs = query.split('&').filter((pair) => pair !== '' && !pair.endsWith('=undefined'));
      return pairs.length === 0 ? path : `${path}?${pairs.join('&')}`;
    },
    run: (step: (current: T) => void) => {
      return act(async () => step(hook()));
    },
  };
}

type RenderAppRouteResult = Awaited<ReturnType<typeof renderRouter>> & {
  queryClient: QueryClient;
  di: TestDi;
};

/**
 * Provider 없이 route 파일 표만 진짜 Expo Router에 올린다. 루트 `_layout`이 앱 Provider 트리(`AppProviders`)를
 * 그 자체로 그려 그 트리를 시험할 때 쓴다. 화면·레이아웃 테스트는 `renderAppRoute`다
 */
export function renderRoutes(routes: Parameters<typeof renderRouter>[0], { url }: { url: string }) {
  return renderRouter(routes, { initialUrl: url });
}

interface RenderAppRouteOptions extends TestProviderOptions {
  /** 처음 여는 URL */
  url: string;
}

/**
 * 진짜 Expo Router에 route 파일 표를 올리고 `renderScreen`과 같은 Provider(DI·조회 캐시·UI)와
 * 레이아웃이 읽는 테마를 둔다. 쓰는 테스트 파일은 `jest.unmock('expo-router')`를 부른다
 */
export async function renderAppRoute(
  routes: Parameters<typeof renderRouter>[0],
  { url, ...options }: RenderAppRouteOptions,
): Promise<RenderAppRouteResult> {
  const { TestProviders, di } = createTestProviders(options);
  function AppRouteProviders({ children }: PropsWithChildren) {
    return (
      <TestProviders>
        <ThemeProvider syncStorage={di.syncStorage}>{children}</ThemeProvider>
      </TestProviders>
    );
  }

  const rendered = await renderRouter(routes, { initialUrl: url, wrapper: AppRouteProviders });
  return Object.assign(rendered, { queryClient: di.queryClient, di });
}

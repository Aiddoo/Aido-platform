import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { MutationErrorFeedback } from '@src/bootstrap/query/mutation-error-feedback';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { createTestDi, type TestDiOverrides } from './di';
import { createTestQueryClient } from './query-client';

interface RenderScreenOptions {
  /**
   * 이 렌더가 바꾸는 포트와 `httpClient` 같은 조립 재료만 넣는다. 나머지는 `createTestDi`가 운영처럼 조립한다.
   * `di: ...`처럼 조립한 컨테이너를 다시 넘기지 않는다.
   */
  di?: TestDiOverrides;
  /** 캐시 상태를 직접 들여다봐야 할 때만 넘긴다. 보통은 비워 둔다. */
  queryClient?: QueryClient;
  /** 화면이 오늘 날짜를 읽으면 켠다 */
  withLocalDate?: boolean;
  /** 시트·다이얼로그를 띄우면 켠다 */
  withOverlay?: boolean;
}

function createHarness({
  di,
  queryClient,
  withLocalDate = false,
  withOverlay = false,
}: RenderScreenOptions) {
  const client = queryClient ?? createTestQueryClient();
  const container = createTestDi({ queryClient: client, ...di });

  function Harness({ children }: { children: ReactNode }) {
    const overlaid = withOverlay ? <OverlayProvider>{children}</OverlayProvider> : children;
    const dated = withLocalDate ? <LocalDateProvider>{overlaid}</LocalDateProvider> : overlaid;

    return (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={client}>
          <TestUiProvider>
            <MutationErrorFeedback />
            {dated}
          </TestUiProvider>
        </QueryClientProvider>
      </StaticDIProvider>
    );
  }

  return { Harness, client, container };
}

/** 앱처럼 토스트·시트가 뜰 자리를 둔다. renderRouter로 직접 감싸는 테스트도 같은 구성을 쓴다 */
export function TestUiProvider({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerProvider>
      <FontScaleProvider>
        <HeroUIProvider
          config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
        >
          {children}
        </HeroUIProvider>
      </FontScaleProvider>
    </GestureHandlerProvider>
  );
}

type RenderScreenResult = Awaited<ReturnType<typeof render>> & { queryClient: QueryClient };

export async function renderScreen(
  ui: ReactElement,
  options: RenderScreenOptions = {},
): Promise<RenderScreenResult> {
  const { Harness, client } = createHarness(options);

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: Harness }), { queryClient: client });
}

type RenderScreenHookResult<TResult> = Awaited<ReturnType<typeof renderHook<TResult, unknown>>> & {
  queryClient: QueryClient;
};

/** `renderScreen`와 같은 provider 위에서 훅을 돌린다. 훅이 읽는 DI는 `di`로 정한다 */
export async function renderScreenHook<TResult>(
  useHook: () => TResult,
  options: RenderScreenOptions = {},
): Promise<RenderScreenHookResult<TResult>> {
  const { Harness, client } = createHarness(options);

  return Object.assign(await renderHook(useHook, { wrapper: Harness }), { queryClient: client });
}

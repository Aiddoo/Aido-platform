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
import type { PropsWithChildren, ReactElement } from 'react';

import { createTestDi, type TestDi } from './di';

export interface TestProviderOptions {
  /** `createTestDi({ ports, seeds })`로 만든 DI. 비우면 기본 stub 포트다. 캐시는 `di.queryClient`다 */
  di?: TestDi;
  /** 화면이 오늘 날짜를 읽으면 켠다 */
  withLocalDate?: boolean;
  /** 시트·다이얼로그를 띄우면 켠다 */
  withOverlay?: boolean;
}

/** 앱처럼 DI·조회 캐시·토스트·시트가 뜰 자리를 둔다. `renderScreen`과 `renderAppRoute`가 같은 구성을 쓴다 */
export function createTestProviders({
  di = createTestDi(),
  withLocalDate = false,
  withOverlay = false,
}: TestProviderOptions) {
  function TestProviders({ children }: PropsWithChildren) {
    const overlaid = withOverlay ? <OverlayProvider>{children}</OverlayProvider> : children;
    const dated = withLocalDate ? <LocalDateProvider>{overlaid}</LocalDateProvider> : overlaid;

    return (
      <StaticDIProvider container={di}>
        <QueryClientProvider client={di.queryClient}>
          <GestureHandlerProvider>
            <FontScaleProvider>
              <HeroUIProvider
                config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
              >
                <MutationErrorFeedback />
                {dated}
              </HeroUIProvider>
            </FontScaleProvider>
          </GestureHandlerProvider>
        </QueryClientProvider>
      </StaticDIProvider>
    );
  }

  return { TestProviders, di };
}

interface RenderedWithDi {
  queryClient: QueryClient;
  di: TestDi;
}

type RenderScreenResult = Awaited<ReturnType<typeof render>> & RenderedWithDi;

export async function renderScreen(
  ui: ReactElement,
  options: TestProviderOptions = {},
): Promise<RenderScreenResult> {
  const { TestProviders, di } = createTestProviders(options);

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: TestProviders }), {
    queryClient: di.queryClient,
    di,
  });
}

interface RenderScreenHookOptions<TProps> extends TestProviderOptions {
  /** 훅 인자가 바뀌는 흐름을 볼 때 처음 값. 바꿀 때는 `rerender(nextProps)`다 */
  initialProps?: TProps;
}

type RenderScreenHookResult<TResult, TProps> = Awaited<
  ReturnType<typeof renderHook<TResult, TProps>>
> &
  RenderedWithDi;

/** `renderScreen`와 같은 provider 위에서 훅을 돌린다. 훅이 읽는 DI는 `di`로 정한다 */
export async function renderScreenHook<TResult, TProps = undefined>(
  useHook: (props: TProps) => TResult,
  { initialProps, ...options }: RenderScreenHookOptions<TProps> = {},
): Promise<RenderScreenHookResult<TResult, TProps>> {
  const { TestProviders, di } = createTestProviders(options);

  return Object.assign(await renderHook(useHook, { wrapper: TestProviders, initialProps }), {
    queryClient: di.queryClient,
    di,
  });
}

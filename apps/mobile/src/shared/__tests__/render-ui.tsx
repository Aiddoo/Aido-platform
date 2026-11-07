import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { createTestDi } from './create-test-di';
import { createTestQueryClient } from './query-client';

export { createTestQueryClient } from './query-client';

interface RenderUiOptions {
  /**
   * 이 렌더가 실제로 쓰는 의존성만 넣는다.
   * 넣지 않은 것에 손대면 컨테이너가 이름을 대며 즉시 실패해 누락이 드러난다.
   */
  di?: Partial<DIContainer>;
  /** 캐시 상태를 직접 들여다봐야 할 때만 넘긴다. 보통은 비워 둔다. */
  queryClient?: QueryClient;
  /** 화면이 오늘 날짜를 읽으면 켠다 */
  withLocalDate?: boolean;
  /** 시트·다이얼로그를 띄우면 켠다 */
  withOverlay?: boolean;
}

type RenderUiResult = Awaited<ReturnType<typeof render>> & { queryClient: QueryClient };

export async function renderUi(
  ui: ReactElement,
  { di, queryClient, withLocalDate = false, withOverlay = false }: RenderUiOptions = {},
): Promise<RenderUiResult> {
  const client = queryClient ?? createTestQueryClient();
  const container = createTestDi(di);

  function Harness({ children }: { children: ReactNode }) {
    const overlaid = withOverlay ? <OverlayProvider>{children}</OverlayProvider> : children;
    const dated = withLocalDate ? <LocalDateProvider>{overlaid}</LocalDateProvider> : overlaid;

    return (
      <GestureHandlerProvider>
        <StaticDIProvider container={container}>
          <QueryClientProvider client={client}>
            <FontScaleProvider>
              <HeroUIProvider
                config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
              >
                {dated}
              </HeroUIProvider>
            </FontScaleProvider>
          </QueryClientProvider>
        </StaticDIProvider>
      </GestureHandlerProvider>
    );
  }

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: Harness }), { queryClient: client });
}

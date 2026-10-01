import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { createMockDIContainer } from './create-mock-di-container';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderUiOptions {
  /**
   * 이 렌더가 실제로 쓰는 의존성만 넣는다.
   * 넣지 않은 것에 손대면 컨테이너가 이름을 대며 즉시 실패해 누락이 드러난다.
   */
  di?: Partial<DIContainer>;
  /** 캐시 상태를 직접 들여다봐야 할 때만 넘긴다. 보통은 비워 둔다. */
  queryClient?: QueryClient;
}

type RenderUiResult = Awaited<ReturnType<typeof render>> & { queryClient: QueryClient };

export async function renderUi(
  ui: ReactElement,
  { di, queryClient }: RenderUiOptions = {},
): Promise<RenderUiResult> {
  const client = queryClient ?? createTestQueryClient();
  const container = createMockDIContainer(di);

  function Harness({ children }: { children: ReactNode }) {
    return (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={client}>
          <FontScaleProvider>
            <HeroUIProvider
              config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
            >
              {children}
            </HeroUIProvider>
          </FontScaleProvider>
        </QueryClientProvider>
      </StaticDIProvider>
    );
  }

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: Harness }), { queryClient: client });
}

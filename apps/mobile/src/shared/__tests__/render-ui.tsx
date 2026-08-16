import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { createMockDIContainer } from './create-mock-di-container';

/**
 * 테스트용 QueryClient.
 *
 * 재시도를 끄는 게 핵심이다 — 켜 두면 실패를 검증하는 테스트가 기본 백오프만큼
 * 기다렸다가 타임아웃으로 죽고, 원인이 "느렸다"로만 보인다.
 */
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

/**
 * 우리 UI 컴포넌트를 앱에서와 같은 문맥에 세운다.
 *
 * heroui-native 컴포넌트는 `HeroUINativeProvider` 없이는 애니메이션 설정을 읽다 죽고,
 * 글꼴 배율은 `FontScaleProvider`가 소유한다. 이 문맥이 없어서 나는 실패는 컴포넌트의
 * 결함이 아니므로, 테스트마다 다시 세우는 대신 여기 한 번만 세운다.
 *
 * 라이브러리를 통째로 mock해 우회하지 않는다 — 그러면 검증하려던 배선이 함께 사라진다.
 * 네이티브 경계는 jest.config.js의 moduleNameMapper가 공식 mock으로 대체한다.
 */
/** RTL 14의 render 결과 + 이 렌더가 쓴 QueryClient. 명시하지 않으면 타입이 pnpm 경로에 묶인다. */
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
            <HeroUIProvider>{children}</HeroUIProvider>
          </FontScaleProvider>
        </QueryClientProvider>
      </StaticDIProvider>
    );
  }

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: Harness }), { queryClient: client });
}

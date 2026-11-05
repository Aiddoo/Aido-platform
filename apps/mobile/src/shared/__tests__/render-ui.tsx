import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { createMockDIContainer } from './create-mock-di-container';
import { createTestQueryClient } from './query-client';

export { createTestQueryClient } from './query-client';

jest.mock('expo-router', () => {
  const { Pressable, Text, View } = require('react-native');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  // 네이티브 헤더는 Jest에서 그려지지 않는다. 눌러 볼 수 있게 접근성 이름이 있는 버튼으로 바꾼다
  const Toolbar = ({ children }: { children: ReactNode }) => children;
  Toolbar.Button = ({
    hidden,
    disabled,
    accessibilityLabel,
    onPress,
  }: {
    hidden?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
    onPress?: () => void;
  }) =>
    hidden ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      />
    );
  Toolbar.Menu = ({
    hidden,
    accessibilityLabel,
    children,
  }: {
    hidden?: boolean;
    accessibilityLabel?: string;
    children: ReactNode;
  }) =>
    hidden ? null : (
      <View accessibilityRole="menu" accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  Toolbar.MenuAction = ({ children, onPress }: { children: ReactNode; onPress?: () => void }) => (
    <Pressable accessibilityRole="menuitem" onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  );
  const Stack = {
    Toolbar,
    Screen: ({ options }: { options?: { title?: string; headerTitle?: () => ReactNode } }) =>
      options?.headerTitle?.() ?? <Text>{options?.title}</Text>,
  };
  return {
    Stack,
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useIsFocused: jest.fn(() => true),
    useNavigation: () => ({ isFocused: () => true }),
    Redirect: () => null,
  };
});

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
      <GestureHandlerProvider>
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
      </GestureHandlerProvider>
    );
  }

  // RTL 14의 render는 비동기다. 그리고 반환 객체는 전개하면 쿼리 메서드가 떨어져 나가므로
  // 전개하지 않고 그대로 넘긴다.
  return Object.assign(await render(ui, { wrapper: Harness }), { queryClient: client });
}

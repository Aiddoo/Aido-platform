import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: jest.fn(),
  dismissTo: jest.fn(),
};
export const useLocalSearchParams = jest.fn();
export const useGlobalSearchParams = jest.fn();
export const useIsFocused = jest.fn();
export const usePathname = jest.fn();
export const useSegments = jest.fn();
export const useFocusEffect = jest.fn();

function useRunFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect]);
}

/**
 * clearMocks는 호출 기록만, restoreMocks는 spy만 되돌려 mockReturnValue가 다음 테스트로 샌다.
 * jest.setup의 beforeEach가 불러 테스트마다 기본값에서 시작하게 한다.
 */
export function resetExpoRouterMock() {
  Object.values(router).forEach((method) => {
    method.mockReset();
  });
  router.canGoBack.mockReturnValue(true);
  router.canDismiss.mockReturnValue(false);
  useLocalSearchParams.mockReset().mockImplementation(() => ({}));
  useGlobalSearchParams.mockReset().mockImplementation(() => ({}));
  useIsFocused.mockReset().mockReturnValue(true);
  usePathname.mockReset().mockReturnValue('/');
  useSegments.mockReset().mockReturnValue([]);
  useFocusEffect.mockReset().mockImplementation(useRunFocusEffect);
}

resetExpoRouterMock();

// 네이티브 헤더는 Jest에서 그려지지 않는다. 눌러 볼 수 있게 접근성 이름이 있는 버튼으로 바꾼다
function Toolbar({ children }: { children: ReactNode }) {
  return children;
}

Toolbar.Button = function ToolbarButton({
  hidden,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  hidden?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  return hidden ? null : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
    />
  );
};

Toolbar.Menu = function ToolbarMenu({
  hidden,
  accessibilityLabel,
  children,
}: {
  hidden?: boolean;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  return hidden ? null : (
    <View accessibilityRole="menu" accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
};

Toolbar.MenuAction = function ToolbarMenuAction({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole="menuitem" onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  );
};

function StackScreen({ options }: { options?: { title?: string; headerTitle?: () => ReactNode } }) {
  return options?.headerTitle?.() ?? <Text>{options?.title}</Text>;
}

export const Stack = { Toolbar, Screen: StackScreen };

export function useRouter() {
  return router;
}

export function useNavigation() {
  return { isFocused: () => true, getParent: () => undefined };
}

export function Redirect() {
  return null;
}

// ThemeProvider는 내비게이션 컨텍스트에 테마만 전한다. 테스트는 배경색이 정해지는지만 읽는다
export const DarkTheme = { colors: { background: 'black' } };
export const DefaultTheme = { colors: { background: 'white' } };
export function ThemeProvider({ children }: { children: ReactNode }) {
  return children;
}

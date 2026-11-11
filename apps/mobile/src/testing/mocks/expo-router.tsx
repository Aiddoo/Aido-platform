import { Children, cloneElement, isValidElement, useEffect } from 'react';
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
  return process.env.EXPO_OS === 'ios' ? (
    <Pressable accessibilityRole="menuitem" onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  ) : null;
};

interface LinkPressEvent {
  defaultPrevented: boolean;
  preventDefault: () => void;
}

/**
 * 실제 Link(asChild)처럼 행의 onPress → Link의 onPress 순서로 부르고, 막지 않았으면 router.navigate로 간다.
 * 미리보기·메뉴는 실제처럼 iOS에서만 그린다. 미리보기는 붙었는지만 보이게 testID로, 메뉴는 눌러 볼 수 있게
 * 메뉴 항목 버튼으로 바꾼다
 */
export function Link({
  href,
  onPress,
  children,
}: {
  href: unknown;
  onPress?: (event: LinkPressEvent) => void;
  children: ReactNode;
}) {
  return Children.map(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child) || child.type !== Link.Trigger) {
      return child;
    }
    const trigger = child.props.children;
    if (!isValidElement<{ onPress?: () => void }>(trigger)) {
      return trigger;
    }
    return cloneElement(trigger, {
      onPress: () => {
        trigger.props.onPress?.();
        const event: LinkPressEvent = {
          defaultPrevented: false,
          preventDefault: () => {
            event.defaultPrevented = true;
          },
        };
        onPress?.(event);
        if (!event.defaultPrevented) {
          router.navigate(href);
        }
      },
    });
  });
}

Link.Trigger = function LinkTrigger({ children }: { children: ReactNode }) {
  return children;
};

Link.Preview = function LinkPreview() {
  return process.env.EXPO_OS === 'ios' ? <View testID="link-preview" /> : null;
};

Link.Menu = function LinkMenu({ children }: { children: ReactNode }) {
  return process.env.EXPO_OS === 'ios' ? <View accessibilityRole="menu">{children}</View> : null;
};

Link.MenuAction = function LinkMenuAction({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return process.env.EXPO_OS === 'ios' ? (
    <Pressable accessibilityRole="menuitem" onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  ) : null;
};

function StackScreen({ options }: { options?: { title?: string; headerTitle?: () => ReactNode } }) {
  return options?.headerTitle?.() ?? <Text>{options?.title}</Text>;
}

function StackSearchBar() {
  return null;
}

export const Stack = { Toolbar, Screen: StackScreen, SearchBar: StackSearchBar };

export function useRouter() {
  return router;
}

export function useNavigation() {
  return { isFocused: () => true, getParent: () => undefined, addListener: () => () => undefined };
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

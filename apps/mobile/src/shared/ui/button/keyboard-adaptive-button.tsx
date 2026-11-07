import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './button';
import type { ButtonProps } from './button.types';

const ANIMATION_DURATION_MS = 200;
const CONTAINER_PADDING_X = 16;
const BUTTON_RADIUS = 12;
const DEFAULT_BOTTOM_PADDING = 16;
const STICKY_OFFSET = 0;
/**
 * 포커스한 입력이 키보드 위에 붙은 버튼에 가리지 않게 스크롤 영역에 넘길 값.
 * 키보드 컨트롤러는 칸 전체가 아니라 안쪽 글자 줄(TextInput)을 재므로, 버튼(`xlarge` 56)에 더해
 * 글자 줄 아래 칸 여백(17)과 오류 문구 줄(22), 간격(5)까지 띄운다.
 */
export const KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET = 100;

interface KeyboardAdaptiveButtonProps extends ButtonProps {
  enabled?: boolean;
}

/**
 * 키보드 상태에 따라 스타일이 변하는 버튼 컴포넌트
 */
export function KeyboardAdaptiveButton({
  children,
  enabled = true,
  ...buttonProps
}: KeyboardAdaptiveButtonProps) {
  const insets = useSafeAreaInsets();
  const isKeyboardOpen = useSharedValue(false);

  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      isKeyboardOpen.value = e.height > 0;
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    paddingLeft: withTiming(insets.left + (isKeyboardOpen.value ? 0 : CONTAINER_PADDING_X), {
      duration: ANIMATION_DURATION_MS,
    }),
    paddingRight: withTiming(insets.right + (isKeyboardOpen.value ? 0 : CONTAINER_PADDING_X), {
      duration: ANIMATION_DURATION_MS,
    }),
    paddingBottom: withTiming(isKeyboardOpen.value ? 0 : insets.bottom || DEFAULT_BOTTOM_PADDING, {
      duration: ANIMATION_DURATION_MS,
    }),
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    borderRadius: withTiming(isKeyboardOpen.value ? 0 : BUTTON_RADIUS, {
      duration: ANIMATION_DURATION_MS,
    }),
  }));

  return (
    <KeyboardStickyView offset={{ closed: STICKY_OFFSET, opened: STICKY_OFFSET }} enabled={enabled}>
      <Animated.View style={containerStyle}>
        <Animated.View style={buttonStyle} className="overflow-hidden">
          <Button {...buttonProps} className="rounded-none" style={{ borderRadius: undefined }}>
            {children}
          </Button>
        </Animated.View>
      </Animated.View>
    </KeyboardStickyView>
  );
}

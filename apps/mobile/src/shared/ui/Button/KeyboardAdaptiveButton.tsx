import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import type { ButtonProps } from './Button.types';

const ANIMATION_DURATION_MS = 200;
const CONTAINER_PADDING_X = 16;
const BUTTON_RADIUS = 12;
const DEFAULT_BOTTOM_PADDING = 16;
const STICKY_OFFSET = 0;

/**
 * 키보드 상태에 따라 스타일이 변하는 버튼 컴포넌트
 */
export const KeyboardAdaptiveButton = ({ children, ...buttonProps }: ButtonProps) => {
  const insets = useSafeAreaInsets();
  const isKeyboardOpen = useSharedValue(false);

  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      isKeyboardOpen.value = e.height > 0;
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    paddingHorizontal: withTiming(isKeyboardOpen.value ? 0 : CONTAINER_PADDING_X, {
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
    <KeyboardStickyView offset={{ closed: STICKY_OFFSET, opened: STICKY_OFFSET }}>
      <Animated.View style={containerStyle} className="bg-white pt-3">
        <Animated.View style={buttonStyle} className="overflow-hidden">
          <Button {...buttonProps} className="rounded-none" style={{ borderRadius: undefined }}>
            {children}
          </Button>
        </Animated.View>
      </Animated.View>
    </KeyboardStickyView>
  );
};

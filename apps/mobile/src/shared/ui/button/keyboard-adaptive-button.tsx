import { use } from 'react';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardFooterHeightContext } from '../form-step-layout/keyboard-footer-height';
import { Button } from './button';
import type { ButtonProps } from './button.types';

const ANIMATION_DURATION_MS = 200;
const CONTAINER_PADDING_X = 16;
const BUTTON_RADIUS = 12;
const DEFAULT_BOTTOM_PADDING = 16;
const STICKY_OFFSET = 0;

/** 모양(둥근 모서리·여백)은 키보드에 맞춰 이 부품이 정하므로 `className`·`style`은 받지 않는다 */
interface KeyboardAdaptiveButtonProps extends Omit<ButtonProps, 'className' | 'style'> {
  /** 키보드를 따라 올라갈지. `KeyboardStickyView`의 같은 이름 prop으로 넘긴다 */
  enabled?: boolean;
}

export function KeyboardAdaptiveButton({
  children,
  enabled = true,
  ...buttonProps
}: KeyboardAdaptiveButtonProps) {
  const insets = useSafeAreaInsets();
  const reportFooterHeight = use(KeyboardFooterHeightContext);
  const isKeyboardOpen = useSharedValue(false);

  useKeyboardHandler({
    onStart: (event) => {
      'worklet';
      isKeyboardOpen.set(event.height > 0);
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    paddingLeft: withTiming(insets.left + (isKeyboardOpen.get() ? 0 : CONTAINER_PADDING_X), {
      duration: ANIMATION_DURATION_MS,
    }),
    paddingRight: withTiming(insets.right + (isKeyboardOpen.get() ? 0 : CONTAINER_PADDING_X), {
      duration: ANIMATION_DURATION_MS,
    }),
    paddingBottom: withTiming(isKeyboardOpen.get() ? 0 : insets.bottom || DEFAULT_BOTTOM_PADDING, {
      duration: ANIMATION_DURATION_MS,
    }),
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    borderRadius: withTiming(isKeyboardOpen.get() ? 0 : BUTTON_RADIUS, {
      duration: ANIMATION_DURATION_MS,
    }),
  }));

  return (
    <KeyboardStickyView offset={{ closed: STICKY_OFFSET, opened: STICKY_OFFSET }} enabled={enabled}>
      <Animated.View style={containerStyle}>
        {/* 키보드가 열리면 바깥 여백이 0이 되어 버튼 높이만 키보드 위를 덮는다. 바깥 여백은 애니메이션 중 매 프레임 바뀌므로 버튼만 잰다 */}
        <Animated.View
          style={buttonStyle}
          className="overflow-hidden"
          onLayout={(event) => reportFooterHeight?.(event.nativeEvent.layout.height)}
        >
          <Button {...buttonProps} className="rounded-none" style={{ borderRadius: undefined }}>
            {children}
          </Button>
        </Animated.View>
      </Animated.View>
    </KeyboardStickyView>
  );
}
